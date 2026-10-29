import { all, first } from "@/lib/db";
import {
	GALLERY_PAGE_SIZE,
	type GalleryItem,
	type GalleryStats,
} from "@/lib/domain";
import { derivativeUrl } from "@/lib/storage";

type GalleryRow = {
	id: string;
	width: number | null;
	height: number | null;
	blur_data_url: string | null;
	created_at: string;
};

type GalleryCursor = { createdAt: string; id: string };

export function encodeGalleryCursor(cursor: GalleryCursor) {
	return Buffer.from(JSON.stringify(cursor)).toString("base64url");
}

export function decodeGalleryCursor(value: string): GalleryCursor | null {
	try {
		const parsed = JSON.parse(
			Buffer.from(value, "base64url").toString("utf8"),
		) as Partial<GalleryCursor>;
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

/** The gallery rule, as SQL. The slideshow and the picker reuse it verbatim. */
export const GALLERY_ELIGIBLE =
	"hot_status = 'uploaded' and moderation_status = 'approved'";

export async function getGalleryPage(siteId: string, cursor?: string | null) {
	const params: (string | number)[] = [siteId];
	let where = `site_id = ? and ${GALLERY_ELIGIBLE}`;
	if (cursor) {
		const decoded = decodeGalleryCursor(cursor);
		if (!decoded) throw new Error("Nieprawidłowy kursor galerii.");
		where += " and (created_at < ? or (created_at = ? and id < ?))";
		params.push(decoded.createdAt, decoded.createdAt, decoded.id);
	}
	params.push(GALLERY_PAGE_SIZE + 1);
	const rows = await all<GalleryRow>(
		`select id, width, height, blur_data_url, created_at from photos
		 where ${where}
		 order by created_at desc, id desc
		 limit ?`,
		params,
	);
	const hasMore = rows.length > GALLERY_PAGE_SIZE;
	const visible = rows.slice(0, GALLERY_PAGE_SIZE);
	const lastVisible = visible.at(-1);
	return {
		items: visible.map(
			(row): GalleryItem => ({
				id: row.id,
				imageUrl: derivativeUrl(row.id),
				width: row.width,
				height: row.height,
				blurDataUrl: row.blur_data_url,
				createdAt: row.created_at,
			}),
		),
		nextCursor:
			hasMore && lastVisible
				? encodeGalleryCursor({
						createdAt: lastVisible.created_at,
						id: lastVisible.id,
					})
				: null,
	};
}

export async function getGalleryStats(siteId: string): Promise<GalleryStats> {
	const row = await first<{ count: number }>(
		`select count(*) as count from photos where site_id = ? and ${GALLERY_ELIGIBLE}`,
		[siteId],
	);
	return { approvedPhotos: row?.count ?? 0 };
}
