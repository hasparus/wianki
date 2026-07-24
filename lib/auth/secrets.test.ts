import { describe, expect, it } from "vitest";
import { secretMatches } from "./secrets";

describe("secretMatches", () => {
	it("accepts only the exact secret", () => {
		expect(secretMatches("correct horse", "correct horse")).toBe(true);
		expect(secretMatches("correct horse!", "correct horse")).toBe(false);
		expect(secretMatches("", "correct horse")).toBe(false);
	});
});
