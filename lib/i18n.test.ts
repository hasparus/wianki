import { describe, expect, it } from "vitest";
import { formatGalleryStats } from "@/lib/i18n";

describe("Polish gallery statistics", () => {
	it.each([
		[0, 0, ""],
		[1, 1, "1 gość dodał już 1 zdjęcie"],
		[2, 2, "2 gości dodało już 2 zdjęcia"],
		[4, 4, "4 gości dodało już 4 zdjęcia"],
		[5, 5, "5 gości dodało już 5 zdjęć"],
		[12, 12, "12 gości dodało już 12 zdjęć"],
		[22, 22, "22 gości dodało już 22 zdjęcia"],
		[25, 25, "25 gości dodało już 25 zdjęć"],
	])("declines %i guests and %i photos", (guests, photos, expected) => {
		expect(formatGalleryStats(guests, photos)).toBe(expected);
	});
});
