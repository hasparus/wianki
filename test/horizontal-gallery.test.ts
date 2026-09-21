import { describe, expect, it } from "vitest";
import {
	galleryRowsAfterZoom,
	horizontalGalleryLayout,
} from "@/components/gallery/horizontal-gallery";

describe("horizontal gallery zoom", () => {
	it("uses fewer rows for larger photos", () => {
		expect(galleryRowsAfterZoom(3, "in")).toBe(2);
		expect(galleryRowsAfterZoom(2, "in")).toBe(1);
	});

	it("uses more rows for smaller photos", () => {
		expect(galleryRowsAfterZoom(1, "out")).toBe(2);
		expect(galleryRowsAfterZoom(2, "out")).toBe(3);
	});

	it("stops at the fixed-height rail limits", () => {
		expect(galleryRowsAfterZoom(1, "in")).toBe(1);
		expect(galleryRowsAfterZoom(3, "out")).toBe(3);
	});
});

describe("horizontal gallery geometry", () => {
	const items = Array.from({ length: 9 }, (_, index) => ({
		width: index % 2 ? 4 : 3,
		height: index % 2 ? 3 : 4,
	}));

	it.each([1, 2, 3] as const)(
		"keeps item order monotonic with %i row(s)",
		(rows) => {
			const layout = horizontalGalleryLayout(items, rows, 1440, 544);
			for (let index = 1; index < layout.items.length; index += 1) {
				expect(layout.items[index].x).toBeGreaterThanOrEqual(
					layout.items[index - 1].x,
				);
			}
		},
	);

	it("fills short rails without changing column-major order", () => {
		const layout = horizontalGalleryLayout(items, 2, 1920, 544);
		expect(layout.width).toBe(1920);
		expect(layout.items[0].x).toBe(layout.items[1].x);
		expect(layout.items[2].x).toBeGreaterThan(layout.items[1].x);
		expect(layout.items[0].y).toBeLessThan(layout.items[1].y);
		const last = layout.items.at(-1);
		expect(last && last.x + last.width).toBe(1920);
	});
});
