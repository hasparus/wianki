import QRCode from "qrcode";
import { GALLERY_BUCKET } from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import {
	clampSlideSeconds,
	SLIDESHOW_DEFAULT_SECONDS,
} from "@/lib/slideshow-protocol";
import { supabaseAdmin } from "@/lib/supabase/server";

export const SLIDESHOW_AUTO_LIMIT = 150;
const SIGNED_URL_SECONDS = 60 * 60 * 6;

export type SlideshowSlide = {
	id: string;
	kind: "photo" | "text";
	imageUrl: string | null;
	width: number | null;
	height: number | null;
	title: string | null;
	subtitle: string | null;
};

export type SlideshowDeck = {
	slides: SlideshowSlide[];
	source: "custom" | "auto";
};

export async function getSlideSeconds(): Promise<number> {
	const { data, error } = await supabaseAdmin()
		.from("slideshow_settings")
		.select("slide_seconds")
		.limit(1)
		.maybeSingle();
	if (error || !data) return SLIDESHOW_DEFAULT_SECONDS;
	return clampSlideSeconds(data.slide_seconds);
}

export async function setSlideSeconds(seconds: number): Promise<number> {
	const slideSeconds = clampSlideSeconds(seconds);
	const { error } = await supabaseAdmin()
		.from("slideshow_settings")
		.update({ slide_seconds: slideSeconds })
		.eq("id", true);
	if (error) throw error;
	return slideSeconds;
}

export type SlideshowJoinInfo = {
	/** QR code of the full join URL as a data URL, palette-matched. */
	qrDataUrl: string;
};

/**
 * The corner QR shown during the show. Only exists when GUEST_JOIN_CODE is
 * configured; the QR encodes `/p/<code>`, which the proxy exchanges for a
 * guest session. Colors mirror scripts/generate-qr.ts.
 */
export async function getSlideshowJoinInfo(): Promise<SlideshowJoinInfo | null> {
	const env = serverEnv();
	if (!env.GUEST_JOIN_CODE) return null;
	const joinUrl = `${env.APP_ORIGIN}/p/${encodeURIComponent(env.GUEST_JOIN_CODE)}`;
	const qrDataUrl = await QRCode.toDataURL(joinUrl, {
		width: 240,
		margin: 1,
		errorCorrectionLevel: "M",
		color: { dark: "#1d3322", light: "#fbf6ef" },
	});
	return { qrDataUrl };
}

export type AdminSlide = {
	id: string;
	kind: "photo" | "text";
	position: number;
	title: string | null;
	subtitle: string | null;
	photoId: string | null;
	photoVisible: boolean;
	imageUrl: string | null;
};

type SlideRow = {
	id: string;
	position: number;
	kind: "photo" | "text";
	title: string | null;
	subtitle: string | null;
	photo_id: string | null;
	photos: {
		id: string;
		storage_path: string;
		width: number | null;
		height: number | null;
		hot_status: string;
		moderation_status: string;
	} | null;
};

function isPhotoVisible(photo: SlideRow["photos"]) {
	return (
		photo !== null &&
		photo.hot_status === "uploaded" &&
		photo.moderation_status === "approved"
	);
}

/** A reorder request must be a permutation of the current slide ids. */
export function isValidSlideOrder(currentIds: string[], order: string[]) {
	if (currentIds.length !== order.length) return false;
	if (new Set(order).size !== order.length) return false;
	const expected = new Set(currentIds);
	return order.every((id) => expected.has(id));
}

async function fetchSlideRows() {
	const { data, error } = await supabaseAdmin()
		.from("slideshow_slides")
		.select(
			"id,position,kind,title,subtitle,photo_id,photos(id,storage_path,width,height,hot_status,moderation_status)",
		)
		.order("position", { ascending: true })
		.order("created_at", { ascending: true });
	if (error) throw error;
	return (data ?? []) as unknown as SlideRow[];
}

/**
 * Signs every derivative in one request rather than one per slide — an
 * auto-generated deck can be 150 photos long.
 */
async function signPaths(paths: string[]): Promise<Map<string, string>> {
	if (paths.length === 0) return new Map();
	const { data, error } = await supabaseAdmin()
		.storage.from(GALLERY_BUCKET)
		.createSignedUrls(paths, SIGNED_URL_SECONDS);
	if (error) throw error;
	return new Map(
		(data ?? []).flatMap((entry) =>
			entry.path && entry.signedUrl ? [[entry.path, entry.signedUrl]] : [],
		),
	);
}

/**
 * The guest-facing deck. Photo slides whose photo left the gallery
 * (hidden, deleted, unmoderated) are silently dropped: the slideshow obeys
 * the same eligibility rule as the gallery.
 */
export async function getSlideshowDeck(): Promise<SlideshowDeck> {
	const all = await fetchSlideRows();
	if (all.length === 0)
		return { slides: await getAutoSlides(), source: "auto" };
	const rows = all.filter(
		(row) => row.kind === "text" || isPhotoVisible(row.photos),
	);
	const signed = await signPaths(
		rows.flatMap((row) =>
			row.kind === "photo" && row.photos ? [row.photos.storage_path] : [],
		),
	);
	const slides = rows.map((row): SlideshowSlide => {
		const photo = row.kind === "photo" ? row.photos : null;
		return {
			id: row.id,
			kind: row.kind,
			imageUrl: photo ? (signed.get(photo.storage_path) ?? null) : null,
			width: photo?.width ?? null,
			height: photo?.height ?? null,
			title: row.title,
			subtitle: row.subtitle,
		};
	});
	return { slides, source: "custom" };
}

/** Without a curated deck the show plays the gallery chronologically. */
async function getAutoSlides(): Promise<SlideshowSlide[]> {
	const { data, error } = await supabaseAdmin()
		.from("photos")
		.select("id,storage_path,width,height")
		.eq("hot_status", "uploaded")
		.eq("moderation_status", "approved")
		.order("created_at", { ascending: true })
		.order("id", { ascending: true })
		.limit(SLIDESHOW_AUTO_LIMIT);
	if (error) throw error;
	const rows = data ?? [];
	const signed = await signPaths(rows.map((row) => row.storage_path));
	return rows.map((row) => ({
		id: row.id,
		kind: "photo" as const,
		imageUrl: signed.get(row.storage_path) ?? null,
		width: row.width,
		height: row.height,
		title: null,
		subtitle: null,
	}));
}

export async function getAdminSlides(): Promise<AdminSlide[]> {
	const rows = await fetchSlideRows();
	const signed = await signPaths(
		rows.flatMap((row) =>
			isPhotoVisible(row.photos) && row.photos ? [row.photos.storage_path] : [],
		),
	);
	return rows.map((row): AdminSlide => {
		const visible = isPhotoVisible(row.photos);
		return {
			id: row.id,
			kind: row.kind,
			position: row.position,
			title: row.title,
			subtitle: row.subtitle,
			photoId: row.photo_id,
			photoVisible: row.kind === "photo" ? visible : true,
			imageUrl:
				row.photos && visible
					? (signed.get(row.photos.storage_path) ?? null)
					: null,
		};
	});
}
