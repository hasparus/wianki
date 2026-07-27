import { GALLERY_BUCKET } from "@/lib/domain";
import { supabaseAdmin } from "@/lib/supabase/server";

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
	storage_path: string;
	drive_file_id: string | null;
	original_filename: string;
	hot_status: string;
	archive_status: string;
	moderation_status: string;
	last_error: string | null;
	created_at: string;
};

type AdminCursor = { createdAt: string; id: string };

export function isAdminPhotoActionable(
	photo: Pick<AdminRow, "hot_status" | "archive_status" | "drive_file_id">,
) {
	return !(
		photo.hot_status === "deleted" &&
		(photo.archive_status === "trashed" || photo.drive_file_id === null)
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

export async function getAdminPhotosPage(
	cursor?: string | null,
): Promise<AdminPhotoPage> {
	const supabase = supabaseAdmin();
	let query = supabase
		.from("photos")
		.select(
			"id,storage_path,drive_file_id,original_filename,hot_status,archive_status,moderation_status,last_error,created_at",
		)
		.or(
			"hot_status.neq.deleted,and(archive_status.neq.trashed,drive_file_id.not.is.null)",
		)
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.limit(ADMIN_PAGE_SIZE + 1);
	if (cursor) {
		const decoded = decodeAdminCursor(cursor);
		if (!decoded) throw new Error("Nieprawidłowy kursor panelu.");
		query = query.or(
			`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
		);
	}
	const { data, error } = await query;
	if (error) throw error;
	const rows = ((data ?? []) as AdminRow[]).filter(isAdminPhotoActionable);
	const hasMore = rows.length > ADMIN_PAGE_SIZE;
	const visible = rows.slice(0, ADMIN_PAGE_SIZE);
	const lastVisible = visible.at(-1);
	const photos = await Promise.all(
		visible.map(async (row): Promise<AdminPhoto> => {
			let imageUrl: string | null = null;
			if (row.hot_status === "uploaded") {
				const { data: signed } = await supabase.storage
					.from(GALLERY_BUCKET)
					.createSignedUrl(row.storage_path, 60 * 30);
				imageUrl = signed?.signedUrl ?? null;
			}
			return {
				id: row.id,
				imageUrl,
				originalFilename: row.original_filename,
				hotStatus: row.hot_status,
				archiveStatus: row.archive_status,
				moderationStatus: row.moderation_status,
				lastError: row.last_error,
				createdAt: row.created_at,
			};
		}),
	);
	return {
		photos,
		nextCursor:
			hasMore && lastVisible
				? encodeAdminCursor({
						createdAt: lastVisible.created_at,
						id: lastVisible.id,
					})
				: null,
	};
}

export async function getAdminQueue(): Promise<AdminPhoto[]> {
	const page = await getAdminPhotosPage();
	return page.photos;
}
