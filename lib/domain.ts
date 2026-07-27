export const MAX_BATCH_FILES = 10;
export const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
export const MAX_DERIVATIVE_BYTES = 500 * 1024;
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
	createdAt: string;
};

export type GalleryStats = {
	approvedPhotos: number;
	contributingGuests: number;
};

export type SafeSearchScores = {
	adult: string;
	racy: string;
	violence: string;
	medical?: string;
	spoof?: string;
};
