export const GALLERY_ROW_LEVELS = [1, 2, 3] as const;

export type GalleryRows = (typeof GALLERY_ROW_LEVELS)[number];

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

export type HorizontalGalleryLayout = {
	items: GalleryGeometry[];
	/** Plates held for photographs the server counted but has not sent yet. */
	placeholders: GalleryGeometry[];
	/** Right edge of the last loaded photograph; loading more is keyed to it. */
	loadedWidth: number;
	width: number;
};

/**
 * Lay the rail out for every photograph the gallery holds, not only the pages
 * loaded so far. `reserved` trailing plates follow the loaded ones in the same
 * column-major order, so a page arriving by scroll fills plates that were
 * already standing there instead of growing the rail under the guest.
 */
export function horizontalGalleryLayout(
	items: ReadonlyArray<{ width: number | null; height: number | null }>,
	rows: GalleryRows,
	viewportWidth: number,
	viewportHeight: number,
	gap = 2,
	slots: readonly number[] = items.map((_, index) => index),
	reserved = 0,
): HorizontalGalleryLayout {
	if (
		(!items.length && !reserved) ||
		viewportWidth <= 0 ||
		viewportHeight <= 0
	) {
		return {
			items: [],
			placeholders: [],
			loadedWidth: 0,
			width: viewportWidth,
		};
	}

	const rowHeight = (viewportHeight - gap * (rows - 1)) / rows;
	if (rows === 1) {
		const fallbackWidth = rowHeight * (4 / 3);
		const naturalWidths = [
			...items.map((item) =>
				item.width && item.height
					? rowHeight * (item.width / item.height)
					: fallbackWidth,
			),
			...Array.from({ length: reserved }, () => fallbackWidth),
		];
		const totalGap = gap * Math.max(0, naturalWidths.length - 1);
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
		const loaded = geometry.slice(0, items.length);
		const lastLoaded = loaded.at(-1);
		return {
			items: loaded,
			placeholders: geometry.slice(items.length),
			loadedWidth: lastLoaded ? lastLoaded.x + lastLoaded.width : 0,
			width: Math.max(viewportWidth, x - gap),
		};
	}

	const firstReservedSlot = (slots.at(-1) ?? -1) + 1;
	const columns = Math.ceil((firstReservedSlot + reserved) / rows);
	const totalGap = gap * Math.max(0, columns - 1);
	const columnWidth = Math.max(
		rowHeight,
		(viewportWidth - totalGap) / Math.max(1, columns),
	);
	const place = (slot: number) => ({
		x: Math.floor(slot / rows) * (columnWidth + gap),
		y: (slot % rows) * (rowHeight + gap),
		width: columnWidth,
		height: rowHeight,
	});
	const geometry = items.map((_, index) => place(slots[index] ?? index));
	const lastLoaded = geometry.at(-1);

	return {
		items: geometry,
		placeholders: Array.from({ length: reserved }, (_, index) =>
			place(firstReservedSlot + index),
		),
		loadedWidth: lastLoaded ? lastLoaded.x + lastLoaded.width : 0,
		width: Math.max(viewportWidth, columns * columnWidth + totalGap),
	};
}
