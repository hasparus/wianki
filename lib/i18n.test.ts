import { describe, expect, it } from "vitest";
import { formatGalleryStats, guestCountNoun, photoCountNoun } from "@/lib/i18n";

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

describe("Polish count nouns", () => {
	it.each([
		[0, "zdjęć"],
		[1, "zdjęcie"],
		[2, "zdjęcia"],
		[5, "zdjęć"],
		[22, "zdjęcia"],
		[25, "zdjęć"],
	])("declines the photo noun for %i", (count, expected) => {
		expect(photoCountNoun(count)).toBe(expected);
	});

	it.each([
		[0, "gości"],
		[1, "gość"],
		[2, "gości"],
		[5, "gości"],
	])("declines the guest noun for %i", (count, expected) => {
		expect(guestCountNoun(count)).toBe(expected);
	});
});
