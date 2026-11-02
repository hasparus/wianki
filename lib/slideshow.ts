import QRCode from "qrcode";
import { all, first, nowIso, run } from "@/lib/db";
import { GALLERY_ELIGIBLE } from "@/lib/gallery";
import type { Site } from "@/lib/sites";
import {
	clampSlideSeconds,
	SLIDESHOW_DEFAULT_SECONDS,
} from "@/lib/slideshow-protocol";
import { derivativeUrl } from "@/lib/storage";

export const SLIDESHOW_AUTO_LIMIT = 150;

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

export async function getSlideSeconds(siteId: string): Promise<number> {
	const row = await first<{ slide_seconds: number }>(
		"select slide_seconds from slideshow_settings where site_id = ?",
		[siteId],
	);
	if (!row) return SLIDESHOW_DEFAULT_SECONDS;
	return clampSlideSeconds(row.slide_seconds);
}

export async function setSlideSeconds(
	siteId: string,
	seconds: number,
): Promise<number> {
	const slideSeconds = clampSlideSeconds(seconds);
	await run(
		`insert into slideshow_settings (site_id, slide_seconds, updated_at) values (?, ?, ?)
		 on conflict (site_id) do update set slide_seconds = excluded.slide_seconds, updated_at = excluded.updated_at`,
		[siteId, slideSeconds, nowIso()],
	);
	return slideSeconds;
}

export type SlideshowJoinInfo = {
	/** QR code of the full join URL as a data URL, palette-matched. */
	qrDataUrl: string;
};

/**
 * The corner QR shown during the show. Only exists when the site has a join
 * code; the QR encodes `/p/<code>`, which the proxy exchanges for a guest
 * session. Colors mirror scripts/generate-qr.ts.
 */
export async function getSlideshowJoinInfo(
	site: Pick<Site, "guest_join_code" | "origin">,
): Promise<SlideshowJoinInfo | null> {
	if (!site.guest_join_code) return null;
	const joinUrl = `${site.origin}/p/${encodeURIComponent(site.guest_join_code)}`;
	const qrDataUrl = await QRCode.toDataURL(joinUrl, {
		width: 240,
		margin: 1,
		errorCorrectionLevel: "M",
		color: { dark: "#1a1a1a", light: "#f7f7f7" },
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
	photo_width: number | null;
	photo_height: number | null;
	photo_hot_status: string | null;
	photo_moderation_status: string | null;
};

function isPhotoVisible(row: SlideRow) {
	return (
		row.photo_id !== null &&
		row.photo_hot_status === "uploaded" &&
		row.photo_moderation_status === "approved"
	);
}

/** A reorder request must be a permutation of the current slide ids. */
export function isValidSlideOrder(currentIds: string[], order: string[]) {
	if (currentIds.length !== order.length) return false;
	if (new Set(order).size !== order.length) return false;
	const expected = new Set(currentIds);
	return order.every((id) => expected.has(id));
}

async function fetchSlideRows(siteId: string) {
	return all<SlideRow>(
		`select s.id, s.position, s.kind, s.title, s.subtitle, s.photo_id,
		        p.width as photo_width, p.height as photo_height,
		        p.hot_status as photo_hot_status, p.moderation_status as photo_moderation_status
		 from slideshow_slides s
		 left join photos p on p.id = s.photo_id
		 where s.site_id = ?
		 order by s.position asc, s.created_at asc`,
		[siteId],
	);
}

/**
 * The guest-facing deck. Photo slides whose photo left the gallery
 * (hidden, deleted, unmoderated) are silently dropped: the slideshow obeys
 * the same eligibility rule as the gallery.
 */
export async function getSlideshowDeck(siteId: string): Promise<SlideshowDeck> {
	const rows = await fetchSlideRows(siteId);
	if (rows.length === 0)
		return { slides: await getAutoSlides(siteId), source: "auto" };
	const slides = rows
		.filter((row) => row.kind === "text" || isPhotoVisible(row))
		.map(
			(row): SlideshowSlide => ({
				id: row.id,
				kind: row.kind,
				imageUrl:
					row.kind === "photo" && row.photo_id
						? derivativeUrl(row.photo_id)
						: null,
				width: row.photo_width,
				height: row.photo_height,
				title: row.title,
				subtitle: row.subtitle,
			}),
		);
	return { slides, source: "custom" };
}

/** Without a curated deck the show plays the gallery chronologically. */
async function getAutoSlides(siteId: string): Promise<SlideshowSlide[]> {
	const rows = await all<{
		id: string;
		width: number | null;
		height: number | null;
	}>(
		`select id, width, height from photos
		 where site_id = ? and ${GALLERY_ELIGIBLE}
		 order by created_at asc, id asc
		 limit ?`,
		[siteId, SLIDESHOW_AUTO_LIMIT],
	);
	return rows.map((row) => ({
		id: row.id,
		kind: "photo" as const,
		imageUrl: derivativeUrl(row.id),
		width: row.width,
		height: row.height,
		title: null,
		subtitle: null,
	}));
}

export async function getAdminSlides(siteId: string): Promise<AdminSlide[]> {
	const rows = await fetchSlideRows(siteId);
	return rows.map((row): AdminSlide => {
		const visible = isPhotoVisible(row);
		return {
			id: row.id,
			kind: row.kind,
			position: row.position,
			title: row.title,
			subtitle: row.subtitle,
			photoId: row.photo_id,
			photoVisible: row.kind === "photo" ? visible : true,
			imageUrl: visible && row.photo_id ? derivativeUrl(row.photo_id) : null,
		};
	});
}
