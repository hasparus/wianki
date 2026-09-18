import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

function sourceFiles(dir: string): string[] {
	return readdirSync(dir).flatMap((entry) => {
		const path = join(dir, entry);
		if (statSync(path).isDirectory()) return sourceFiles(path);
		return path.endsWith(".tsx") ? [path] : [];
	});
}

function tagName(node: ts.JsxElement) {
	return node.openingElement.tagName.getText(node.getSourceFile());
}

function isArrow(node: ts.Node) {
	return (
		ts.isJsxSelfClosingElement(node) &&
		/^Arrow(Left|Right)Icon$/.test(node.tagName.getText(node.getSourceFile()))
	);
}

/**
 * Every element that carries a long arrow, with the tag it was opened as.
 *
 * Parsed with the compiler rather than matched with a regex: the arrow sits at
 * an arbitrary depth inside its action, and a pattern that tries to read JSX
 * nesting by hand silently stops seeing a carrier the moment someone wraps the
 * label in a span — which is exactly when the test still has to fire.
 */
function arrowCarriers() {
	const carriers: { file: string; tag: string }[] = [];
	for (const file of [...sourceFiles("app"), ...sourceFiles("components")]) {
		const source = ts.createSourceFile(
			file,
			readFileSync(file, "utf8"),
			ts.ScriptTarget.Latest,
			// Positions are needed so tagName can read its own text back.
			true,
			ts.ScriptKind.TSX,
		);
		const visit = (node: ts.Node) => {
			if (ts.isJsxElement(node) && node.children.some(isArrow)) {
				carriers.push({ file, tag: tagName(node) });
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
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

	it("sees a carrier whose label is wrapped, which a regex scan would miss", () => {
		const source = ts.createSourceFile(
			"fixture.tsx",
			'<button type="button" onClick={go}><span>Dalej</span><ArrowRightIcon /></button>',
			ts.ScriptTarget.Latest,
			true,
			ts.ScriptKind.TSX,
		);
		const found: string[] = [];
		const visit = (node: ts.Node) => {
			if (ts.isJsxElement(node) && node.children.some(isArrow)) {
				found.push(tagName(node));
			}
			ts.forEachChild(node, visit);
		};
		visit(source);
		expect(found).toEqual(["button"]);
	});
});
