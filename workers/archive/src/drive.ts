import {
	type ArchiveBackend,
	type ArchivedObject,
	sanitizeObjectName,
	type UploadClaims,
} from "./backend";
import { badRequest, upstreamFailed } from "./claims";

export type DriveEnv = {
	GOOGLE_OAUTH_CLIENT_ID: string;
	GOOGLE_OAUTH_CLIENT_SECRET: string;
	GOOGLE_OAUTH_REFRESH_TOKEN: string;
	GOOGLE_DRIVE_FOLDER_ID: string;
};

type DriveFile = {
	id: string;
	size?: string;
	trashed?: boolean;
	appProperties?: { photoId?: string; siteId?: string };
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
	if (!response.ok)
		throw upstreamFailed("Google OAuth odrzucił token odświeżania.");
	const body = (await response.json()) as { access_token?: string };
	if (!body.access_token)
		throw upstreamFailed("Google OAuth nie zwrócił tokenu.");
	return body.access_token;
}

function fileUrl(fileId: string, fields?: string) {
	const url = new URL(
		`https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}`,
	);
	url.searchParams.set("supportsAllDrives", "true");
	if (fields) url.searchParams.set("fields", fields);
	return url;
}

async function trash(token: string, fileId: string) {
	const response = await fetch(fileUrl(fileId), {
		method: "PATCH",
		headers: {
			Authorization: `Bearer ${token}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ trashed: true }),
	});
	if (!response.ok) throw upstreamFailed("Drive nie przeniósł pliku do kosza.");
}

/**
 * Originals land in one user-owned Drive folder, tagged with
 * `appProperties.photoId` and `appProperties.siteId` so a lost `archive_key`
 * can be recovered by searching rather than guessing a name, and so a file
 * id handed to `remove` can be checked against the site and photo the token
 * names before anything is trashed. Deleting trashes the file: Drive keeps
 * it recoverable for 30 days, unlike the R2 backend, where removal is
 * immediate and final.
 *
 * Drive is the self-hoster's alternative to R2: one deployment, one folder.
 * The site id still travels with every file so a later move to R2 can put
 * each original under its site prefix.
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
						appProperties: { photoId: claims.photoId, siteId: claims.siteId },
					}),
				},
			);
			const sessionUrl = session.headers.get("Location");
			if (!session.ok || !sessionUrl) {
				throw upstreamFailed("Nie udało się rozpocząć wysyłki do Drive.");
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
			if (!uploaded.ok) throw upstreamFailed("Drive nie przyjął oryginału.");
			const file = (await uploaded.json()) as { id?: string; size?: string };
			if (!file.id)
				throw upstreamFailed("Drive nie zwrócił identyfikatora pliku.");
			// Measure what Drive stored rather than echoing the token back, so a
			// truncated upload cannot produce a receipt that finalization trusts.
			const stored = Number(file.size);
			if (!Number.isFinite(stored) || stored !== claims.size) {
				await trash(token, file.id).catch(() => {});
				throw badRequest("Zapisany rozmiar nie zgadza się z tokenem.");
			}
			return { key: file.id, size: stored };
		},

		async find(siteId: string, photoId: string) {
			const token = await accessToken(env);
			const url = new URL("https://www.googleapis.com/drive/v3/files");
			url.searchParams.set(
				"q",
				`trashed = false and appProperties has { key='photoId' and value='${photoId}' } and appProperties has { key='siteId' and value='${siteId}' }`,
			);
			url.searchParams.set("fields", "files(id,size)");
			url.searchParams.set("pageSize", "1");
			url.searchParams.set("supportsAllDrives", "true");
			url.searchParams.set("includeItemsFromAllDrives", "true");
			const response = await fetch(url, {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (!response.ok) throw upstreamFailed("Nie udało się przeszukać Drive.");
			const body = (await response.json()) as { files?: DriveFile[] };
			const file = body.files?.[0];
			return file ? { key: file.id, size: Number(file.size ?? 0) } : null;
		},

		async remove(siteId: string, photoId: string, key: string) {
			const token = await accessToken(env);
			// A Drive file id carries no site prefix, so the file's own tags are
			// the guard: the one the token names, or nothing happens.
			const response = await fetch(fileUrl(key, "id,appProperties"), {
				headers: { Authorization: `Bearer ${token}` },
			});
			if (response.status === 404) {
				throw badRequest("Klucz nie należy do tego zdjęcia.");
			}
			if (!response.ok) throw upstreamFailed("Nie udało się odczytać Drive.");
			const file = (await response.json()) as DriveFile;
			if (
				file.appProperties?.photoId !== photoId ||
				file.appProperties?.siteId !== siteId
			) {
				throw badRequest("Klucz nie należy do tego zdjęcia.");
			}
			await trash(token, key);
		},
	};
}
