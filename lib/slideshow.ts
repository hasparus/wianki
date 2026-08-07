import QRCode from "qrcode";
import { GALLERY_BUCKET } from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import { supabaseAdmin } from "@/lib/supabase/server";

export const SLIDESHOW_MAX_TITLE = 120;
export const SLIDESHOW_MAX_SUBTITLE = 200;
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

export type SlideshowJoinInfo = {
	/** Human-readable join address, protocol stripped. */
	label: string;
	/** QR code of the full join URL as a data URL, palette-matched. */
	qrDataUrl: string;
};

/**
 * The corner QR shown during the show. Only exists when GUEST_JOIN_CODE is
 * configured; the QR encodes `/p/<code>`, which the proxy exchanges for a
 * guest session. Colors mirror scripts/generate-qr.mjs.
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
	return { label: joinUrl.replace(/^https?:\/\//, ""), qrDataUrl };
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

async function signPath(path: string) {
	const { data, error } = await supabaseAdmin()
		.storage.from(GALLERY_BUCKET)
		.createSignedUrl(path, SIGNED_URL_SECONDS);
	if (error) throw error;
	return data.signedUrl;
}

/**
 * The guest-facing deck. Photo slides whose photo left the gallery
 * (hidden, deleted, unmoderated) are silently dropped: the slideshow obeys
 * the same eligibility rule as the gallery.
 */
export async function getSlideshowDeck(): Promise<SlideshowDeck> {
	const rows = await fetchSlideRows();
	if (rows.length > 0) {
		const slides = await Promise.all(
			rows
				.filter((row) => row.kind === "text" || isPhotoVisible(row.photos))
				.map(async (row): Promise<SlideshowSlide> => {
					const photo = row.kind === "photo" ? row.photos : null;
					return {
						id: row.id,
						kind: row.kind,
						imageUrl: photo ? await signPath(photo.storage_path) : null,
						width: photo?.width ?? null,
						height: photo?.height ?? null,
						title: row.title,
						subtitle: row.subtitle,
					};
				}),
		);
		return { slides, source: "custom" };
	}
	return { slides: await getAutoSlides(), source: "auto" };
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
	return Promise.all(
		(data ?? []).map(async (row) => ({
			id: row.id,
			kind: "photo" as const,
			imageUrl: await signPath(row.storage_path),
			width: row.width,
			height: row.height,
			title: null,
			subtitle: null,
		})),
	);
}

export async function getAdminSlides(): Promise<AdminSlide[]> {
	const rows = await fetchSlideRows();
	return Promise.all(
		rows.map(async (row): Promise<AdminSlide> => {
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
						? await signPath(row.photos.storage_path)
						: null,
			};
		}),
	);
}
