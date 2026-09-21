import { describe, expect, it } from "vitest";
import {
	galleryRowsAfterPinch,
	galleryRowsAfterZoom,
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

	it("maps pinch scale to larger and smaller photographs", () => {
		expect(galleryRowsAfterPinch(2, 1.3)).toBe(1);
		expect(galleryRowsAfterPinch(2, 0.75)).toBe(3);
		expect(galleryRowsAfterPinch(2, 1.05)).toBe(2);
	});

	it("can cross both zoom stops with a decisive pinch", () => {
		expect(galleryRowsAfterPinch(3, 1.75)).toBe(1);
		expect(galleryRowsAfterPinch(1, 0.55)).toBe(3);
	});
});
