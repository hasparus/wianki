import type { SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { describe, expect, it, vi } from "vitest";
import { parseBlurDataUrl } from "@/lib/blur-placeholder";
import { MAX_BLUR_DATA_URL_LENGTH } from "@/lib/domain";
import {
	backfillBlurPlaceholders,
	type PreviewBackfillStore,
	previewBackfillStore,
} from "@/scripts/lib/backfill-blur-placeholders";
import { encodeBlurPreview } from "@/scripts/lib/blur-preview";

function fakeStore(count: number) {
	const missing = new Map(
		Array.from({ length: count }, (_, index) => {
			const id = `photo-${index}`;
			return [id, { id, storage_path: `derivative-${index}` }] as const;
		}),
	);
	const store: PreviewBackfillStore = {
		countMissing: vi.fn(async () => missing.size),
		takeMissing: vi.fn(async (limit) =>
			Array.from(missing.values()).slice(0, limit),
		),
		download: vi.fn(async () => Buffer.from("derivative")),
		saveIfEligible: vi.fn(async (id) => missing.delete(id)),
	};
	return { store, missing };
}

const encode = vi.fn(async () => "data:image/jpeg;base64,preview");

describe("private blur preview backfill", () => {
	it("counts missing previews without downloading or updating", async () => {
		const { store } = fakeStore(94);
		expect(await backfillBlurPlaceholders(store, false)).toBe(94);
		expect(store.takeMissing).not.toHaveBeenCalled();
		expect(store.download).not.toHaveBeenCalled();
		expect(store.saveIfEligible).not.toHaveBeenCalled();
	});

	it("drains multiple first-page batches and reruns idempotently", async () => {
		const { store } = fakeStore(55);
		expect(await backfillBlurPlaceholders(store, true, encode)).toBe(55);
		expect(await backfillBlurPlaceholders(store, true, encode)).toBe(0);
		expect(store.takeMissing).toHaveBeenCalledWith(50);
		expect(store.download).toHaveBeenCalledTimes(55);
	});

	it("never writes if deletion removes the derivative before download", async () => {
		const { store } = fakeStore(1);
		store.download = vi.fn(async () => {
			throw new Error("Derivative was deleted");
		});
		await expect(backfillBlurPlaceholders(store, true, encode)).rejects.toThrow(
			"Derivative was deleted",
		);
		expect(store.saveIfEligible).not.toHaveBeenCalled();
	});

	it("skips a row deleted after download but before the guarded write", async () => {
		const { store, missing } = fakeStore(1);
		store.saveIfEligible = vi.fn(async (id) => {
			missing.delete(id);
			return false;
		});
		expect(await backfillBlurPlaceholders(store, true, encode)).toBe(0);
		expect(missing.size).toBe(0);
	});

	it("stops instead of looping when an eligible write never succeeds", async () => {
		const { store } = fakeStore(1);
		store.saveIfEligible = vi.fn(async () => false);
		await expect(backfillBlurPlaceholders(store, true, encode)).rejects.toThrow(
			"no progress",
		);
	});

	it("guards the database write against deletion, hiding, and duplicate work", async () => {
		const query = {
			eq: vi.fn().mockReturnThis(),
			is: vi.fn().mockReturnThis(),
			select: vi.fn().mockResolvedValue({ data: [], error: null }),
		};
		const update = vi.fn(() => query);
		const client = {
			from: vi.fn(() => ({ update })),
		} as unknown as SupabaseClient;
		const saved = await previewBackfillStore(client).saveIfEligible(
			"photo-1",
			"data:image/jpeg;base64,preview",
		);
		expect(saved).toBe(false);
		expect(query.eq.mock.calls).toEqual([
			["id", "photo-1"],
			["hot_status", "uploaded"],
			["moderation_status", "approved"],
		]);
		expect(query.is).toHaveBeenCalledWith("blur_data_url", null);
	});
});

describe("CLI preview encoder", () => {
	it("makes the same valid, bounded JPEG from a derivative for uploads and backfills", async () => {
		const derivative = await sharp({
			create: {
				width: 100,
				height: 50,
				channels: 3,
				background: "#555555",
			},
		})
			.jpeg()
			.toBuffer();
		const preview = await encodeBlurPreview(derivative);
		expect(parseBlurDataUrl(preview)).toBe(preview);
		expect(preview.length).toBeLessThan(MAX_BLUR_DATA_URL_LENGTH);
	});

	it("fails before any database write if the downloaded derivative cannot be decoded", async () => {
		const { store } = fakeStore(1);
		await expect(
			backfillBlurPlaceholders(store, true, encodeBlurPreview),
		).rejects.toThrow();
		expect(store.saveIfEligible).not.toHaveBeenCalled();
	});
});
