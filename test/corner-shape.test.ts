import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Comments talk about the property too, so they are stripped before counting.
const css = readFileSync("app/globals.css", "utf8").replace(
	/\/\*[\s\S]*?\*\//g,
	"",
);

/**
 * The corner language is the scoop — a corner cut into the plane, never one
 * bulging out of it. `corner-shape` needs a radius to bite into, so the radius
 * only exists inside the feature query; a browser without corner-shape must
 * never inherit a rounded corner as a consolation prize.
 */
function featureQueryBody() {
	const start = css.indexOf("@supports (corner-shape: scoop)");
	expect(start).toBeGreaterThan(-1);
	let depth = 0;
	let index = css.indexOf("{", start);
	const open = index;
	for (; index < css.length; index += 1) {
		if (css[index] === "{") depth += 1;
		if (css[index] === "}") {
			depth -= 1;
			if (depth === 0) return css.slice(open, index + 1);
		}
	}
	throw new Error("unterminated @supports block");
}

describe("the cut corner", () => {
	it("declares corner-shape only inside its feature query", () => {
		const guarded = featureQueryBody();
		const all = [...css.matchAll(/corner-shape\s*:/g)];
		const inside = [...guarded.matchAll(/corner-shape\s*:/g)];
		// One extra match for the @supports condition itself.
		expect(all.length).toBe(inside.length + 1);
	});

	it("falls back to a square corner, never a round one", () => {
		const guarded = featureQueryBody();
		const outside = css.replace(guarded, "");
		expect(outside).not.toMatch(/border-radius\s*:/);
		expect(outside).not.toMatch(/border-[a-z-]*-radius\s*:/);
	});

	it("scoops every corner it rounds", () => {
		const guarded = featureQueryBody();
		const radii = [...guarded.matchAll(/border-radius\s*:/g)].length;
		const shapes = [...guarded.matchAll(/corner-shape\s*:\s*scoop/g)].length;
		expect(radii).toBe(shapes);
		expect(radii).toBeGreaterThan(0);
	});
});
