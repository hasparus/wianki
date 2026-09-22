export const MAX_BATCH_FILES = 10;
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const MAX_DERIVATIVE_BYTES = 500 * 1024;
/**
 * Blur-up placeholder, built the way next/image builds one for a static
 * import: an 8px-wide JPEG at quality 70, stored as a data URL. Around
 * 300-700 characters in practice; the cap keeps a hostile client from
 * parking kilobytes in every row.
 */
export const BLUR_IMAGE_SIZE = 8;
export const BLUR_IMAGE_QUALITY = 70;
export const MAX_BLUR_DATA_URL_LENGTH = 4096;
export const GALLERY_PAGE_SIZE = 25;
export const GALLERY_BUCKET = "gallery";

export const acceptedOriginalTypes = [
	"image/jpeg",
	"image/png",
	"image/webp",
	"image/heic",
	"image/heif",
] as const;

export const acceptedDerivativeTypes = [
	"image/webp",
	"image/jpeg",
	"image/png",
] as const;

export type HotStatus = "pending" | "uploaded" | "failed" | "deleted";
export type ArchiveStatus =
	| "pending"
	| "uploaded"
	| "failed"
	| "trashed"
	| "deletion_error";
export type ModerationStatus =
	| "pending"
	| "approved"
	| "flagged"
	| "review_required"
	| "rejected";

export type GalleryItem = {
	id: string;
	imageUrl: string;
	width: number | null;
	height: number | null;
	/** Tiny JPEG data URL for next/image's blur placeholder, if one was stored. */
	blurDataUrl: string | null;
	createdAt: string;
};

export type GalleryStats = {
	approvedPhotos: number;
};

export type SafeSearchScores = {
	adult: string;
	racy: string;
	violence: string;
	medical?: string;
	spoof?: string;
};
