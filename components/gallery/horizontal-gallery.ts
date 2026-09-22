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

export type GallerySlotState = {
	itemIds: readonly string[];
	rows: GalleryRows;
	slots: readonly number[];
};

function startsWith(items: readonly string[], prefix: readonly string[]) {
	return prefix.every((item, index) => items[index] === item);
}

function endsWith(items: readonly string[], suffix: readonly string[]) {
	const offset = items.length - suffix.length;
	return (
		offset >= 0 && suffix.every((item, index) => items[offset + index] === item)
	);
}

/**
 * Keep existing plates in their row when polling prepends fresh photographs.
 * A partial incoming column leaves intentional empty slots at its end; shifting
 * the old slots by complete columns means no photograph jumps vertically.
 */
export function gallerySlotState(
	previous: GallerySlotState | null,
	itemIds: readonly string[],
	rows: GalleryRows,
): GallerySlotState {
	if (!previous || previous.rows !== rows) {
		return { itemIds, rows, slots: itemIds.map((_, index) => index) };
	}
	if (
		previous.itemIds.length === itemIds.length &&
		startsWith(itemIds, previous.itemIds)
	) {
		return previous;
	}

	if (itemIds.length > previous.itemIds.length) {
		const added = itemIds.length - previous.itemIds.length;
		if (endsWith(itemIds, previous.itemIds)) {
			const shift = Math.ceil(added / rows) * rows;
			return {
				itemIds,
				rows,
				slots: [
					...itemIds.slice(0, added).map((_, index) => index),
					...previous.slots.map((slot) => slot + shift),
				],
			};
		}
		if (startsWith(itemIds, previous.itemIds)) {
			const nextSlot = (previous.slots.at(-1) ?? -1) + 1;
			return {
				itemIds,
				rows,
				slots: [
					...previous.slots,
					...itemIds
						.slice(previous.itemIds.length)
						.map((_, index) => nextSlot + index),
				],
			};
		}
	}

	return { itemIds, rows, slots: itemIds.map((_, index) => index) };
}

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
	slots: readonly number[] = items.map((_, index) => index),
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

	const lastSlot = slots.at(-1) ?? -1;
	const columns = Math.ceil((lastSlot + 1) / rows);
	const totalGap = gap * Math.max(0, columns - 1);
	const columnWidth = Math.max(
		rowHeight,
		(viewportWidth - totalGap) / Math.max(1, columns),
	);
	const geometry = items.map((_, index) => ({
		x: Math.floor((slots[index] ?? index) / rows) * (columnWidth + gap),
		y: ((slots[index] ?? index) % rows) * (rowHeight + gap),
		width: columnWidth,
		height: rowHeight,
	}));

	return {
		items: geometry,
		width: Math.max(viewportWidth, columns * columnWidth + totalGap),
	};
}
