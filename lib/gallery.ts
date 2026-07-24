import {
	GALLERY_BUCKET,
	GALLERY_PAGE_SIZE,
	type GalleryItem,
	type GalleryStats,
} from "@/lib/domain";
import { supabaseAdmin } from "@/lib/supabase/server";

type GalleryRow = {
	id: string;
	storage_path: string;
	width: number | null;
	height: number | null;
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

export async function getGalleryPage(cursor?: string | null) {
	const supabase = supabaseAdmin();
	let query = supabase
		.from("photos")
		.select("id,storage_path,width,height,created_at")
		.eq("hot_status", "uploaded")
		.eq("moderation_status", "approved")
		.order("created_at", { ascending: false })
		.order("id", { ascending: false })
		.limit(GALLERY_PAGE_SIZE + 1);
	if (cursor) {
		const decoded = decodeGalleryCursor(cursor);
		if (!decoded) throw new Error("Nieprawidłowy kursor galerii.");
		query = query.or(
			`created_at.lt.${decoded.createdAt},and(created_at.eq.${decoded.createdAt},id.lt.${decoded.id})`,
		);
	}
	const { data, error } = await query;
	if (error) throw error;
	const rows = (data ?? []) as GalleryRow[];
	const hasMore = rows.length > GALLERY_PAGE_SIZE;
	const visible = rows.slice(0, GALLERY_PAGE_SIZE);
	const lastVisible = visible.at(-1);
	const signed = await Promise.all(
		visible.map(async (row): Promise<GalleryItem> => {
			const { data: url, error: urlError } = await supabase.storage
				.from(GALLERY_BUCKET)
				.createSignedUrl(row.storage_path, 60 * 60);
			if (urlError) throw urlError;
			return {
				id: row.id,
				imageUrl: url.signedUrl,
				width: row.width,
				height: row.height,
				createdAt: row.created_at,
			};
		}),
	);
	return {
		items: signed,
		nextCursor:
			hasMore && lastVisible
				? encodeGalleryCursor({
						createdAt: lastVisible.created_at,
						id: lastVisible.id,
					})
				: null,
	};
}

export async function getGalleryStats(): Promise<GalleryStats> {
	const { data, error, count } = await supabaseAdmin()
		.from("photos")
		.select("guest_id", { count: "exact" })
		.eq("hot_status", "uploaded")
		.eq("moderation_status", "approved")
		.limit(1000);
	if (error) throw error;
	return {
		approvedPhotos: count ?? 0,
		contributingGuests: new Set(
			(data ?? []).map((row) => (row as { guest_id: string }).guest_id),
		).size,
	};
}
