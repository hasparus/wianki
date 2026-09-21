export const GALLERY_ROW_LEVELS = [1, 2, 3] as const;

export type GalleryRows = (typeof GALLERY_ROW_LEVELS)[number];

export function galleryRowsAfterZoom(
	rows: GalleryRows,
	direction: "in" | "out",
): GalleryRows {
	const index = GALLERY_ROW_LEVELS.indexOf(rows);
	const next = GALLERY_ROW_LEVELS[index + (direction === "in" ? -1 : 1)];
	return next ?? rows;
}

export function galleryRowsAfterPinch(
	rows: GalleryRows,
	scale: number,
): GalleryRows {
	if (scale >= 1.7) return 1;
	if (scale >= 1.16) return galleryRowsAfterZoom(rows, "in");
	if (scale <= 0.6) return 3;
	if (scale <= 0.84) return galleryRowsAfterZoom(rows, "out");
	return rows;
}
