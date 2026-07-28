import { describe, expect, it } from "vitest";
import { retainDeliveredItems } from "@/components/upload/items";
import type { UploadItem, UploadPhase } from "@/components/upload/types";

function item(phase: UploadPhase, previewUrl?: string): UploadItem {
	return {
		id: `${phase}-${previewUrl ?? "none"}`,
		file: new File(["x"], `${phase}.jpg`, { type: "image/jpeg" }),
		phase,
		message: "",
		previewUrl,
	};
}

describe("retainDeliveredItems", () => {
	it("keeps delivered photos and drops everything still pending or failed", () => {
		const delivered = item("done", "blob:done");
		const merge = retainDeliveredItems([
			delivered,
			item("queued", "blob:queued"),
			item("failed", "blob:failed"),
			item("archive_failed", "blob:archive"),
		]);

		expect(merge.kept).toEqual([delivered]);
		expect(merge.droppedPreviewUrls).toEqual([
			"blob:queued",
			"blob:failed",
			"blob:archive",
		]);
	});

	it("does not report previews to revoke for items that never had one", () => {
		const merge = retainDeliveredItems([item("queued"), item("failed")]);

		expect(merge.kept).toEqual([]);
		expect(merge.droppedPreviewUrls).toEqual([]);
	});

	it("keeps every delivered photo across consecutive batches", () => {
		const first = item("done", "blob:first");
		const second = item("done", "blob:second");
		const merge = retainDeliveredItems([first, second, item("queued")]);

		expect(merge.kept).toEqual([first, second]);
	});
});
