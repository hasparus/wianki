import type { SupabaseClient } from "@supabase/supabase-js";
import { GALLERY_BUCKET } from "../../lib/domain.ts";
import { encodeBlurPreview } from "./blur-preview.ts";

export type MissingPreview = { id: string; storage_path: string };

export type PreviewBackfillStore = {
	countMissing(): Promise<number>;
	takeMissing(limit: number): Promise<MissingPreview[]>;
	download(path: string): Promise<Buffer>;
	saveIfEligible(id: string, preview: string): Promise<boolean>;
};

export function previewBackfillStore(
	supabase: SupabaseClient,
): PreviewBackfillStore {
	const eligiblePhotos = () =>
		supabase
			.from("photos")
			.select("id,storage_path")
			.eq("hot_status", "uploaded")
			.eq("moderation_status", "approved")
			.is("blur_data_url", null);

	return {
		async countMissing() {
			const { count, error } = await supabase
				.from("photos")
				.select("id", { count: "exact", head: true })
				.eq("hot_status", "uploaded")
				.eq("moderation_status", "approved")
				.is("blur_data_url", null);
			if (error) throw error;
			return count ?? 0;
		},
		async takeMissing(limit) {
			const { data, error } = await eligiblePhotos()
				.order("id")
				.range(0, limit - 1);
			if (error) throw error;
			return data ?? [];
		},
		async download(path) {
			const { data, error } = await supabase.storage
				.from(GALLERY_BUCKET)
				.download(path);
			if (error || !data) throw error ?? new Error("Missing derivative");
			return Buffer.from(await data.arrayBuffer());
		},
		async saveIfEligible(id, preview) {
			const { data, error } = await supabase
				.from("photos")
				.update({ blur_data_url: preview })
				.eq("id", id)
				.eq("hot_status", "uploaded")
				.eq("moderation_status", "approved")
				.is("blur_data_url", null)
				.select("id");
			if (error) throw error;
			return data?.length === 1;
		},
	};
}

/** Drain the first page; successful writes disappear from the eligible query. */
export async function backfillBlurPlaceholders(
	store: PreviewBackfillStore,
	apply: boolean,
	encode: (derivative: Buffer) => Promise<string> = encodeBlurPreview,
): Promise<number> {
	if (!apply) return store.countMissing();

	let updated = 0;
	let stalledId: string | null = null;
	while (true) {
		const rows = await store.takeMissing(50);
		if (!rows.length) return updated;
		if (rows[0].id === stalledId)
			throw new Error("Backfill made no progress on an eligible photo");

		let savedInBatch = false;
		for (const row of rows) {
			const preview = await encode(await store.download(row.storage_path));
			if (await store.saveIfEligible(row.id, preview)) {
				updated += 1;
				savedInBatch = true;
			}
		}
		stalledId = savedInBatch ? null : rows[0].id;
	}
}
