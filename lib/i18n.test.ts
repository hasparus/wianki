import { describe, expect, it } from "vitest";
import { photoCountNoun } from "@/lib/i18n";

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
});
