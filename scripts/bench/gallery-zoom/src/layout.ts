export type Item = { id: number; src: string; w: number; h: number };
export type Rect = { x: number; y: number; w: number; h: number };
export type Layout = {
	cols: number;
	rects: Rect[];
	height: number;
	gap: number;
};

export function computeLayout(
	items: Item[],
	cols: number,
	width: number,
): Layout {
	const gap = cols === 1 ? 12 : 2;
	const rects: Rect[] = new Array(items.length);
	if (cols === 1) {
		let y = 0;
		for (let i = 0; i < items.length; i++) {
			const h = Math.round((width * items[i].h) / items[i].w);
			rects[i] = { x: 0, y, w: width, h };
			y += h + gap;
		}
		return { cols, rects, height: Math.max(0, y - gap), gap };
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
	return { cols, rects, height: rows * size + (rows - 1) * gap, gap };
}

/** Indices [start, end) whose rect touches [top, bottom]; rect y is non-decreasing by index. */
export function visibleRange(
	layout: Layout,
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

/** Scroll offset in `to` that keeps the item under viewport offset focalY where it is. */
export function anchorScroll(
	from: Layout,
	to: Layout,
	scrollTop: number,
	focalY: number,
): number {
	if (!from.rects.length) return 0;
	const y = scrollTop + focalY;
	const [i] = visibleRange(from, y, y);
	const idx = Math.min(i, from.rects.length - 1);
	const rf = from.rects[idx];
	const rt = to.rects[idx];
	const frac = rf.h ? (y - rf.y) / rf.h : 0;
	return Math.max(0, Math.min(to.height, rt.y + frac * rt.h - focalY));
}

/** A rect as it appears while the whole content is live-scaled by s about (ox, oy). */
export function scaleRect(r: Rect, s: number, ox: number, oy: number): Rect {
	return {
		x: ox + (r.x - ox) * s,
		y: oy + (r.y - oy) * s,
		w: r.w * s,
		h: r.h * s,
	};
}

export function lerpRect(a: Rect, b: Rect, t: number): Rect {
	return {
		x: a.x + (b.x - a.x) * t,
		y: a.y + (b.y - a.y) * t,
		w: a.w + (b.w - a.w) * t,
		h: a.h + (b.h - a.h) * t,
	};
}

export const easeOut = (t: number) => 1 - (1 - t) ** 3;
export const ZOOM_MS = 450;

export function nearestLevel(levels: number[], cols: number) {
	return levels.reduce(
		(best, l) => (Math.abs(l - cols) < Math.abs(best - cols) ? l : best),
		levels[0],
	);
}

export function unionRange(
	a: [number, number],
	b: [number, number],
): [number, number] {
	return [Math.min(a[0], b[0]), Math.max(a[1], b[1])];
}
