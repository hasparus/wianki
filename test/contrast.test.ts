import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function luminance(hex: string) {
	const channels = [1, 3, 5]
		.map((start) => Number.parseInt(hex.slice(start, start + 2), 16) / 255)
		.map((channel) =>
			channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
		);
	return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string) {
	const [lighter, darker] = [luminance(a), luminance(b)].sort((x, y) => y - x);
	return (lighter + 0.05) / (darker + 0.05);
}

describe("wedding palette", () => {
	it("keeps canonical tokens in the global stylesheet", () => {
		const css = readFileSync("app/globals.css", "utf8").toLowerCase();
		for (const color of [
			"#f3b0b7",
			"#f2aebd",
			"#2a482f",
			"#36533a",
			"#fbf6ef",
			"#fcf8f2",
		]) {
			expect(css).toContain(color);
		}
	});

	it("uses AA-safe functional pairings", () => {
		expect(contrast("#2A482F", "#FBF6EF")).toBeGreaterThanOrEqual(4.5);
		expect(contrast("#F3B0B7", "#2A482F")).toBeGreaterThanOrEqual(4.5);
		expect(contrast("#F3B0B7", "#FBF6EF")).toBeLessThan(4.5);
	});
});
