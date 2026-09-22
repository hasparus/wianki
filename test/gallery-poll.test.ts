import { describe, expect, it } from "vitest";
import {
	foldPolledPage,
	mergeFreshItems,
} from "@/components/gallery/gallery-feed";
import type { GalleryItem } from "@/lib/domain";

const item = (id: string) => ({ id }) as GalleryItem;

describe("gallery poll merge", () => {
	it("puts unseen photos in front and keeps loaded pages", () => {
		const loaded = [item("c"), item("b"), item("a")];
		expect(mergeFreshItems(loaded, [item("d"), item("c")])).toEqual([
			item("d"),
			item("c"),
			item("b"),
			item("a"),
		]);
	});

	it("keeps the same array when the poll brings nothing new", () => {
		const loaded = [item("b"), item("a")];
		expect(mergeFreshItems(loaded, [item("b")])).toBe(loaded);
	});
});

describe("folding a polled page into the feed", () => {
	it("takes the whole first page, cursor included, into an empty gallery", () => {
		const page = { items: [item("b"), item("a")], nextCursor: "after-a" };
		expect(foldPolledPage({ items: [], cursor: null }, page)).toEqual({
			items: page.items,
			cursor: "after-a",
		});
	});

	it("only adds new photos in front of a gallery that has pages", () => {
		const loaded = [item("b"), item("a")];
		const folded = foldPolledPage(
			{ items: loaded, cursor: "after-a" },
			{ items: [item("c"), item("b")], nextCursor: "after-b" },
		);
		expect(folded).toEqual({
			items: [item("c"), item("b"), item("a")],
			cursor: "after-a",
		});
	});

	it("does not resurrect a cursor once every page is loaded", () => {
		const loaded = [item("b"), item("a")];
		expect(
			foldPolledPage(
				{ items: loaded, cursor: null },
				{ items: [item("b")], nextCursor: "stale" },
			),
		).toEqual({ items: loaded, cursor: null });
	});
});
