import { describe, expect, it } from "vitest";
import {
	galleryRowsAfterZoom,
	gallerySlotState,
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

describe("horizontal gallery slots", () => {
	it("reserves complete columns when polling prepends partial batches", () => {
		const initial = gallerySlotState(null, ["a", "b", "c"], 2);
		const firstPoll = gallerySlotState(initial, ["new-1", "a", "b", "c"], 2);
		const secondPoll = gallerySlotState(
			firstPoll,
			["new-2", "new-1", "a", "b", "c"],
			2,
		);

		expect(firstPoll.slots).toEqual([0, 2, 3, 4]);
		expect(secondPoll.slots).toEqual([0, 2, 4, 5, 6]);
		expect(secondPoll.slots.slice(2).map((slot) => slot % 2)).toEqual([
			0, 1, 0,
		]);
	});

	it("appends into the next available slot and resets for a density change", () => {
		const initial = gallerySlotState(null, ["a", "b"], 2);
		const prepended = gallerySlotState(initial, ["new", "a", "b"], 2);
		const appended = gallerySlotState(prepended, ["new", "a", "b", "old"], 2);

		expect(appended.slots).toEqual([0, 2, 3, 4]);
		expect(gallerySlotState(appended, appended.itemIds, 1).slots).toEqual([
			0, 1, 2, 3,
		]);
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

	it("keeps stable rows when sparse slots reserve an incoming column", () => {
		const slots = [0, 2, 3, 4];
		const layout = horizontalGalleryLayout(
			items.slice(0, slots.length),
			2,
			800,
			400,
			2,
			slots,
		);

		expect(layout.items.map((item) => item.y)).toEqual([0, 0, 201, 0]);
		expect(layout.items[1].x).toBeGreaterThan(layout.items[0].x);
	});

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
