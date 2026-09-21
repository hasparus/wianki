export const GALLERY_ROW_LEVELS = [1, 2, 3] as const;

export type GalleryRows = (typeof GALLERY_ROW_LEVELS)[number];

export const GALLERY_SPRING = {
	type: "spring" as const,
	stiffness: 520,
	damping: 48,
	mass: 0.72,
};

export type GalleryGeometry = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export function galleryRowsAfterZoom(
	rows: GalleryRows,
	direction: "in" | "out",
): GalleryRows {
	const index = GALLERY_ROW_LEVELS.indexOf(rows);
	const next = GALLERY_ROW_LEVELS[index + (direction === "in" ? -1 : 1)];
	return next ?? rows;
}

export function horizontalGalleryLayout(
	items: ReadonlyArray<{ width: number | null; height: number | null }>,
	rows: GalleryRows,
	viewportWidth: number,
	viewportHeight: number,
	gap = 2,
): { items: GalleryGeometry[]; width: number } {
	if (!items.length || viewportWidth <= 0 || viewportHeight <= 0) {
		return { items: [], width: viewportWidth };
	}

	const rowHeight = (viewportHeight - gap * (rows - 1)) / rows;
	if (rows === 1) {
		const naturalWidths = items.map((item) =>
			item.width && item.height
				? rowHeight * (item.width / item.height)
				: rowHeight * (4 / 3),
		);
		const totalGap = gap * Math.max(0, items.length - 1);
		const naturalWidth = naturalWidths.reduce((sum, width) => sum + width, 0);
		const fillScale = Math.max(
			1,
			(viewportWidth - totalGap) / Math.max(1, naturalWidth),
		);
		let x = 0;
		const geometry = naturalWidths.map((naturalWidth) => {
			const width = naturalWidth * fillScale;
			const item = { x, y: 0, width, height: rowHeight };
			x += width + gap;
			return item;
		});
		return { items: geometry, width: Math.max(viewportWidth, x - gap) };
	}

	const columns = Math.ceil(items.length / rows);
	const totalGap = gap * Math.max(0, columns - 1);
	const columnWidth = Math.max(
		rowHeight,
		(viewportWidth - totalGap) / Math.max(1, columns),
	);
	const geometry = items.map((_, index) => ({
		x: Math.floor(index / rows) * (columnWidth + gap),
		y: (index % rows) * (rowHeight + gap),
		width: columnWidth,
		height: rowHeight,
	}));

	return {
		items: geometry,
		width: Math.max(viewportWidth, columns * columnWidth + totalGap),
	};
}
