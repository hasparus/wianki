import {
	type ArchiveBackend,
	type ArchivedObject,
	sanitizeObjectName,
	type UploadClaims,
} from "./backend";

export type DriveEnv = {
	GOOGLE_OAUTH_CLIENT_ID: string;
	GOOGLE_OAUTH_CLIENT_SECRET: string;
	GOOGLE_OAUTH_REFRESH_TOKEN: string;
	GOOGLE_DRIVE_FOLDER_ID: string;
};

async function accessToken(env: DriveEnv) {
	const response = await fetch("https://oauth2.googleapis.com/token", {
		method: "POST",
		headers: { "Content-Type": "application/x-www-form-urlencoded" },
		body: new URLSearchParams({
			client_id: env.GOOGLE_OAUTH_CLIENT_ID,
			client_secret: env.GOOGLE_OAUTH_CLIENT_SECRET,
			refresh_token: env.GOOGLE_OAUTH_REFRESH_TOKEN,
			grant_type: "refresh_token",
		}),
	});
	if (!response.ok) throw new Error("Google OAuth odrzucił token odświeżania.");
	const body = (await response.json()) as { access_token?: string };
	if (!body.access_token) throw new Error("Google OAuth nie zwrócił tokenu.");
	return body.access_token;
}

/**
 * Originals land in one user-owned Drive folder, tagged with `appProperties.
 * photoId` so a lost `archive_key` can be recovered by searching rather than
 * guessing a name. Deleting trashes the file: Drive keeps it recoverable for
 * 30 days, unlike the R2 backend, where removal is immediate and final.
 */
export function driveBackend(env: DriveEnv): ArchiveBackend {
	return {
		async upload(
			body: ReadableStream,
			claims: UploadClaims,
		): Promise<ArchivedObject> {
			const token = await accessToken(env);
			const session = await fetch(
				"https://www.googleapis.com/upload/drive/v3/files?uploadType=resumable&supportsAllDrives=true&fields=id,size",
				{
					method: "POST",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json; charset=UTF-8",
						"X-Upload-Content-Type": claims.contentType,
						"X-Upload-Content-Length": String(claims.size),
					},
					body: JSON.stringify({
						name: sanitizeObjectName(claims.filename),
						parents: [env.GOOGLE_DRIVE_FOLDER_ID],
						appProperties: { photoId: claims.photoId },
					}),
				},
			);
			const sessionUrl = session.headers.get("Location");
			if (!session.ok || !sessionUrl) {
				throw new Error("Nie udało się rozpocząć wysyłki do Drive.");
			}

			const uploaded = await fetch(sessionUrl, {
				method: "PUT",
				headers: {
					Authorization: `Bearer ${token}`,
					"Content-Type": claims.contentType,
					"Content-Length": String(claims.size),
				},
				body,
			});
			if (!uploaded.ok) throw new Error("Drive nie przyjął oryginału.");
			const file = (await uploaded.json()) as { id?: string };
			if (!file.id) throw new Error("Drive nie zwrócił identyfikatora pliku.");
			return { key: file.id, size: claims.size };
		},

		async find(photoId: string) {
			const token = await accessToken(env);
			const url = new URL("https://www.googleapis.com/drive/v3/files");
			url.searchParams.set(
				"q",
				`trashed = false and appProperties has { key='photoId' and value='${photoId}' }`,
			);
			url.searchParams.set("fields", "files(id,size)");
			url.searchParams.set("pageSize", "1");
			url.searchParams.set("supportsAllDrives", "true");
			url.searchParams.set("includeItemsFromAllDrives", "true");
			const response = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw new Error("Nie udało się przeszukać Drive.");
			const body = (await response.json()) as {
				files?: Array<{ id: string; size?: string }>;
			};
			const file = body.files?.[0];
			return file ? { key: file.id, size: Number(file.size ?? 0) } : null;
		},

		async remove(_photoId: string, key: string) {
			const token = await accessToken(env);
			const response = await fetch(
				`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(key)}?supportsAllDrives=true`,
				{
					method: "PATCH",
					headers: {
						Authorization: `Bearer ${token}`,
						"Content-Type": "application/json",
					},
					body: JSON.stringify({ trashed: true }),
				},
			);
			if (!response.ok) throw new Error("Drive nie przeniósł pliku do kosza.");
		},
	};
}
