import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return path.endsWith(".tsx") ? [path] : [];
	});
}

/** Every element that carries a long arrow, with the tag it was opened as. */
function arrowCarriers() {
	const carriers: { file: string; tag: string }[] = [];
	for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
		const source = readFileSync(file, "utf8");
		for (const match of source.matchAll(
			/<(\w+)[^>]*>(?:(?!<\/?\w)[\s\S])*?<Arrow(?:Left|Right)Icon\s*\/>/g,
		)) {
			carriers.push({ file, tag: match[1] });
		}
	}
	return carriers;
}

describe("the arrow marks travel", () => {
	/**
	 * The long arrow came from the world's own component card, and it earns its
	 * place only by meaning something: it appears on an action that takes you to
	 * another page, and never on one that works where it stands. Link and `a`
	 * are the ones that leave; `button` is the one that does not.
	 */
	it("appears only on elements that navigate", () => {
		const carriers = arrowCarriers();
		expect(carriers.length).toBeGreaterThan(3);
		for (const { file, tag } of carriers) {
			expect({ file, tag }).toEqual({
				file,
				tag: expect.stringMatching(/^(Link|a)$/),
			});
		}
	});

	it("never marks a button", () => {
		const buttons = arrowCarriers().filter(({ tag }) => tag === "button");
		expect(buttons).toEqual([]);
	});
});
