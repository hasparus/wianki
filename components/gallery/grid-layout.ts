import type { GalleryItem } from "@/lib/domain";

/**
 * The grid the way Apple Photos lays one out: square plates at every zoom
 * level but the closest, where each photograph gets its own aspect ratio.
 * Everything here is pure geometry so the renderer only has to place things.
 */

export type Rect = { x: number; y: number; w: number; h: number };

export type GridLayout = {
	cols: number;
	gap: number;
	rects: Rect[];
	height: number;
};

/** Zoom stops for a given grid width, closest first. */
export function zoomLevels(width: number): number[] {
	if (width < 640) return [1, 3, 5, 7];
	if (width < 1024) return [2, 3, 5, 8];
	return [2, 4, 6, 9];
}

export function defaultColumns(width: number) {
	return width < 1024 ? 3 : 4;
}

export function gridGap(cols: number) {
	if (cols === 1) return 16;
	if (cols === 2) return 4;
	return 2;
}

export function computeGridLayout(
	items: Pick<GalleryItem, "width" | "height">[],
	cols: number,
	width: number,
): GridLayout {
	const gap = gridGap(cols);
	const rects: Rect[] = new Array(items.length);
	if (cols === 1) {
		let y = 0;
		for (let i = 0; i < items.length; i++) {
			const ratio =
				items[i].width && items[i].height
					? (items[i].height as number) / (items[i].width as number)
					: 3 / 4;
			const h = Math.round(width * ratio);
			rects[i] = { x: 0, y, w: width, h };
			y += h + gap;
		}
		return { cols, gap, rects, height: Math.max(0, y - gap) };
	}
	const size = (width - gap * (cols - 1)) / cols;
	for (let i = 0; i < items.length; i++) {
		rects[i] = {
			x: (i % cols) * (size + gap),
			y: Math.floor(i / cols) * (size + gap),
			w: size,
			h: size,
		};
	}
	const rows = Math.ceil(items.length / cols);
	return {
		cols,
		gap,
		rects,
		height: rows > 0 ? rows * size + (rows - 1) * gap : 0,
	};
}

/**
 * Indices `[start, end)` of the plates that touch the band `[top, bottom]` in
 * layout coordinates. Rect `y` never decreases with the index, so two binary
 * searches do it.
 */
export function visibleRange(
	layout: GridLayout,
	top: number,
	bottom: number,
): [number, number] {
	const { rects } = layout;
	let lo = 0;
	let hi = rects.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (rects[mid].y + rects[mid].h < top) lo = mid + 1;
		else hi = mid;
	}
	const start = lo;
	hi = rects.length;
	while (lo < hi) {
		const mid = (lo + hi) >> 1;
		if (rects[mid].y <= bottom) lo = mid + 1;
		else hi = mid;
	}
	return [start, lo];
}

/** The plate under a point of the layout, or the nearest one in that row. */
export function plateAt(layout: GridLayout, x: number, y: number) {
	if (!layout.rects.length) return -1;
	const [start, end] = visibleRange(layout, y, y);
	if (start >= layout.rects.length) return layout.rects.length - 1;
	let best = start;
	for (let i = start; i < end; i++) {
		const r = layout.rects[i];
		if (x >= r.x && x < r.x + r.w) return i;
		if (r.x <= x) best = i;
	}
	return best;
}

/**
 * Where the same photograph sits in the next layout. The point is one in the
 * current layout, usually the one between the guest's fingers; the returned
 * y is that point in `to`, so scrolling to keep it still is a subtraction
 * away.
 */
export function focalPointIn(
	from: GridLayout,
	to: GridLayout,
	focalX: number,
	focalY: number,
): number {
	const index = plateAt(from, focalX, focalY);
	if (index < 0) return 0;
	const source = from.rects[index];
	const target = to.rects[index];
	const fraction = source.h
		? Math.min(1, Math.max(0, (focalY - source.y) / source.h))
		: 0;
	return target.y + fraction * target.h;
}

/** A rect as it appears while the whole grid is live-scaled by `s` about a point. */
export function scaleRect(r: Rect, s: number, ox: number, oy: number): Rect {
	return {
		x: ox + (r.x - ox) * s,
		y: oy + (r.y - oy) * s,
		w: r.w * s,
		h: r.h * s,
	};
}

export function nearestLevel(levels: number[], cols: number) {
	return levels.reduce(
		(best, level) =>
			Math.abs(level - cols) < Math.abs(best - cols) ? level : best,
		levels[0],
	);
}

/**
 * A pinch scales the grid by `s`; spreading the fingers (s > 1) means bigger
 * plates, so fewer columns. Soft stops past the outermost levels so the grid
 * resists rather than refuses.
 */
export function clampPinchScale(levels: number[], cols: number, s: number) {
	const min = cols / levels[levels.length - 1];
	const max = cols / levels[0];
	if (s < min) return min * (s / min) ** 0.35;
	if (s > max) return max * (s / max) ** 0.35;
	return s;
}

export function columnsAfterPinch(levels: number[], cols: number, s: number) {
	return nearestLevel(levels, cols / s);
}

export function unionRange(
	a: [number, number],
	b: [number, number],
): [number, number] {
	return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
}
