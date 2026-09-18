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

const PLASTER = "#EFEFEF";
const PLASTER_LIT = "#F7F7F7";
const INK = "#1A1A1A";
const INK_DEEP = "#0A0A0A";
const PINE = "#666666";
const ASH_DEEP = "#B4B4B4";
const BRONZE = "#2A2A2A";
const OXBLOOD = "#8C2318";
const BOTTLE = "#1E4D2B";

describe("tokonoma palette", () => {
	it("keeps canonical tokens in the global stylesheet", () => {
		const css = readFileSync("app/globals.css", "utf8").toLowerCase();
		for (const color of [
			PLASTER,
			PLASTER_LIT,
			INK,
			INK_DEEP,
			PINE,
			ASH_DEEP,
			BRONZE,
			OXBLOOD,
			BOTTLE,
		]) {
			expect(css).toContain(color.toLowerCase());
		}
	});

	it("keeps the interface achromatic apart from the two semantic inks", () => {
		const css = readFileSync("app/globals.css", "utf8");
		const achromatic = [
			PLASTER,
			PLASTER_LIT,
			"#FFFFFF",
			"#D8D8D8",
			ASH_DEEP,
			PINE,
			"#767676",
			BRONZE,
			INK,
			INK_DEEP,
		];
		for (const color of achromatic) {
			const [r, g, b] = [1, 3, 5].map((start) =>
				Number.parseInt(color.slice(start, start + 2), 16),
			);
			expect({ color, r, g, b }).toEqual({ color, r, g: r, b: r });
		}
		// Only error and success may carry a hue.
		const hexes = [...css.matchAll(/#[0-9a-f]{6}/gi)].map((match) =>
			match[0].toUpperCase(),
		);
		const tinted = hexes.filter((hex) => {
			const [r, g, b] = [1, 3, 5].map((start) =>
				Number.parseInt(hex.slice(start, start + 2), 16),
			);
			return r !== g || g !== b;
		});
		expect([...new Set(tinted)].sort()).toEqual([OXBLOOD, BOTTLE].sort());
	});

	it("uses AA-safe functional pairings", () => {
		expect(contrast(INK, PLASTER)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(PINE, PLASTER)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(PLASTER_LIT, INK)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(OXBLOOD, PLASTER)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(BOTTLE, PLASTER)).toBeGreaterThanOrEqual(4.5);
		// The suiban base plane and the night stage.
		expect(contrast(ASH_DEEP, BRONZE)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(PLASTER, INK_DEEP)).toBeGreaterThanOrEqual(4.5);
		expect(contrast(ASH_DEEP, INK_DEEP)).toBeGreaterThanOrEqual(4.5);
	});

	it("keeps the hairline rule below text contrast, so it never reads as type", () => {
		expect(contrast("#D8D8D8", PLASTER)).toBeLessThan(2);
	});
});
