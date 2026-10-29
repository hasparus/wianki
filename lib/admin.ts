import { all } from "@/lib/db";
import { derivativeUrl } from "@/lib/storage";

const ADMIN_PAGE_SIZE = 50;

export type AdminPhoto = {
	id: string;
	imageUrl: string | null;
	originalFilename: string;
	hotStatus: string;
	archiveStatus: string;
	moderationStatus: string;
	lastError: string | null;
	createdAt: string;
};

export type AdminPhotoPage = {
	photos: AdminPhoto[];
	nextCursor: string | null;
};

type AdminRow = {
	id: string;
	archive_key: string | null;
	original_filename: string;
	hot_status: string;
	archive_status: string;
	moderation_status: string;
	last_error: string | null;
	created_at: string;
};

type AdminCursor = { createdAt: string; id: string };

export function isAdminPhotoActionable(
	photo: Pick<AdminRow, "hot_status" | "archive_status" | "archive_key">,
) {
	return !(
		photo.hot_status === "deleted" &&
		(photo.archive_status === "trashed" || photo.archive_key === null)
	);
}

export function encodeAdminCursor(cursor: AdminCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeAdminCursor(value: string): AdminCursor | null {
	try {
		const parsed = JSON.parse(
			Buffer.from(value, "base64url").toString("utf8"),
		) as Partial<AdminCursor>;
		if (
			typeof parsed.createdAt !== "string" ||
			!Number.isFinite(Date.parse(parsed.createdAt)) ||
			typeof parsed.id !== "string" ||
			!/^[0-9a-f-]{36}$/i.test(parsed.id)
		) {
			return null;
		}
		return { createdAt: parsed.createdAt, id: parsed.id };
	} catch {
		return null;
	}
}

/**
 * Every actionable photo state, newest first. Fully deleted tombstones stay
 * in D1 for audit but drop out once neither copy has a retryable action.
 */
export async function getAdminPhotosPage(
	siteId: string,
	cursor?: string | null,
): Promise<AdminPhotoPage> {
	const params: (string | number)[] = [siteId];
	let where =
		"site_id = ? and (hot_status <> 'deleted' or (archive_status <> 'trashed' and archive_key is not null))";
	if (cursor) {
		const decoded = decodeAdminCursor(cursor);
		if (!decoded) throw new Error("Nieprawidłowy kursor panelu.");
		where += " and (created_at < ? or (created_at = ? and id < ?))";
		params.push(decoded.createdAt, decoded.createdAt, decoded.id);
	}
	params.push(ADMIN_PAGE_SIZE + 1);
	const rows = await all<AdminRow>(
		`select id, archive_key, original_filename, hot_status, archive_status,
		        moderation_status, last_error, created_at
		 from photos where ${where}
		 order by created_at desc, id desc
		 limit ?`,
		params,
	);
	const hasMore = rows.length > ADMIN_PAGE_SIZE;
	const visible = rows.slice(0, ADMIN_PAGE_SIZE);
	const lastVisible = visible.at(-1);
	return {
		photos: visible.map(
			(row): AdminPhoto => ({
				id: row.id,
				imageUrl: row.hot_status === "uploaded" ? derivativeUrl(row.id) : null,
				originalFilename: row.original_filename,
				hotStatus: row.hot_status,
				archiveStatus: row.archive_status,
				moderationStatus: row.moderation_status,
				lastError: row.last_error,
				createdAt: row.created_at,
			}),
		),
		nextCursor:
			hasMore && lastVisible
				? encodeAdminCursor({
						createdAt: lastVisible.created_at,
						id: lastVisible.id,
					})
				: null,
	};
}

export async function getAdminQueue(siteId: string): Promise<AdminPhoto[]> {
	const page = await getAdminPhotosPage(siteId);
	return page.photos;
}
