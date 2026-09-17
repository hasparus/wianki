import { describe, expect, it } from "vitest";
import { isValidSlideOrder } from "@/lib/slideshow";

describe("slide reorder validation", () => {
	it("accepts a permutation of the current ids", () => {
		expect(isValidSlideOrder(["a", "b", "c"], ["c", "a", "b"])).toBe(true);
	});

	it("rejects missing, extra, and duplicated ids", () => {
		expect(isValidSlideOrder(["a", "b", "c"], ["a", "b"])).toBe(false);
		expect(isValidSlideOrder(["a", "b"], ["a", "b", "x"])).toBe(false);
		expect(isValidSlideOrder(["a", "b"], ["a", "a"])).toBe(false);
		expect(isValidSlideOrder(["a", "b"], ["a", "x"])).toBe(false);
	});
});
