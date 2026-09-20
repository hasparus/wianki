import { describe, expect, it } from "vitest";
import {
	clampPinchScale,
	columnsAfterPinch,
	computeGridLayout,
	focalPointIn,
	nearestLevel,
	plateAt,
	scaleRect,
	unionRange,
	visibleRange,
	zoomLevels,
} from "@/components/gallery/grid-layout";

const photos = (count: number) =>
	Array.from({ length: count }, (_, i) => ({
		width: i % 2 ? 1440 : 1920,
		height: i % 2 ? 1920 : 1440,
	}));

describe("grid layout", () => {
	it("lays square plates in rows with a hairline gap", () => {
		const layout = computeGridLayout(photos(7), 3, 304);
		expect(layout.gap).toBe(2);
		expect(layout.rects[0]).toEqual({ x: 0, y: 0, w: 100, h: 100 });
		expect(layout.rects[4]).toEqual({ x: 102, y: 102, w: 100, h: 100 });
		expect(layout.height).toBe(3 * 100 + 2 * 2);
	});

	it("gives every photograph its own aspect ratio at one column", () => {
		const layout = computeGridLayout(photos(2), 1, 400);
		expect(layout.rects[0]).toEqual({ x: 0, y: 0, w: 400, h: 300 });
		expect(layout.rects[1]).toEqual({ x: 0, y: 316, w: 400, h: 533 });
		expect(layout.height).toBe(316 + 533);
	});

	it("falls back to 4:3 when a photo has no stored dimensions", () => {
		const layout = computeGridLayout([{ width: null, height: null }], 1, 400);
		expect(layout.rects[0].h).toBe(300);
	});

	it("is empty without photos", () => {
		expect(computeGridLayout([], 3, 300)).toMatchObject({
			rects: [],
			height: 0,
		});
		expect(visibleRange(computeGridLayout([], 3, 300), 0, 100)).toEqual([0, 0]);
	});
});

describe("visible range", () => {
	it("returns the plates touching a band, half-open", () => {
		const layout = computeGridLayout(photos(30), 3, 304);
		// Rows are 102px apart: the band 150..260 covers rows 1 and 2.
		expect(visibleRange(layout, 150, 260)).toEqual([3, 9]);
		expect(visibleRange(layout, -500, -10)).toEqual([0, 0]);
		expect(visibleRange(layout, 5000, 6000)).toEqual([30, 30]);
	});
});

describe("focal anchoring", () => {
	it("keeps the photograph under the fingers in place across zoom levels", () => {
		const items = photos(60);
		const from = computeGridLayout(items, 5, 500);
		const to = computeGridLayout(items, 3, 500);
		// Point inside plate 12 (row 2, col 2) at 40% of its height.
		const focalX = from.rects[12].x + 5;
		const focalY = from.rects[12].y + from.rects[12].h * 0.4;
		expect(plateAt(from, focalX, focalY)).toBe(12);
		const target = focalPointIn(from, to, focalX, focalY);
		expect(target).toBeCloseTo(to.rects[12].y + to.rects[12].h * 0.4, 5);
	});

	it("takes the nearest plate when the point is in a gap or past the row", () => {
		const layout = computeGridLayout(photos(6), 3, 304);
		expect(plateAt(layout, 101, 50)).toBe(0);
		expect(plateAt(layout, 900, 50)).toBe(2);
		expect(plateAt(layout, 0, 50)).toBe(0);
		expect(plateAt(computeGridLayout([], 3, 304), 0, 0)).toBe(-1);
	});

	it("clamps a point past the last plate to it", () => {
		const items = photos(4);
		const from = computeGridLayout(items, 2, 200);
		const to = computeGridLayout(items, 1, 200);
		expect(focalPointIn(from, to, 0, 10_000)).toBe(
			to.rects[3].y + to.rects[3].h,
		);
	});
});

describe("pinch arithmetic", () => {
	it("scales a rect about the pinch centre", () => {
		expect(scaleRect({ x: 10, y: 10, w: 10, h: 10 }, 2, 0, 0)).toEqual({
			x: 20,
			y: 20,
			w: 20,
			h: 20,
		});
		expect(scaleRect({ x: 10, y: 10, w: 10, h: 10 }, 2, 15, 15)).toEqual({
			x: 5,
			y: 5,
			w: 20,
			h: 20,
		});
	});

	it("spreading the fingers lands on fewer columns", () => {
		const levels = zoomLevels(390);
		expect(levels).toEqual([1, 3, 5, 7]);
		expect(columnsAfterPinch(levels, 5, 1.6)).toBe(3);
		expect(columnsAfterPinch(levels, 5, 0.7)).toBe(7);
		expect(columnsAfterPinch(levels, 3, 1.05)).toBe(3);
		expect(columnsAfterPinch(levels, 3, 2.5)).toBe(1);
	});

	it("resists past the outermost levels instead of refusing", () => {
		const levels = zoomLevels(390);
		expect(clampPinchScale(levels, 5, 1.2)).toBe(1.2);
		const past = clampPinchScale(levels, 1, 3);
		expect(past).toBeGreaterThan(1);
		expect(past).toBeLessThan(3);
		const under = clampPinchScale(levels, 7, 0.2);
		expect(under).toBeLessThan(1);
		expect(under).toBeGreaterThan(0.2);
	});

	it("picks the nearest zoom stop and unions ranges", () => {
		expect(nearestLevel([2, 4, 6, 9], 7.4)).toBe(6);
		expect(nearestLevel([2, 4, 6, 9], 0)).toBe(2);
		expect(unionRange([3, 9], [6, 20])).toEqual([3, 20]);
	});
});
