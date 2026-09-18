import { describe, expect, it } from "vitest";
import { mergeFreshItems } from "@/components/gallery/gallery-feed";
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
