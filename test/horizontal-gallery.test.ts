import { describe, expect, it } from "vitest";
import { galleryRowsAfterZoom } from "@/components/gallery/horizontal-gallery";

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
