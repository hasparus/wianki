#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";
import { parseBlurDataUrl } from "../lib/blur-placeholder.ts";
import {
	BLUR_IMAGE_QUALITY,
	BLUR_IMAGE_SIZE,
	GALLERY_BUCKET,
} from "../lib/domain.ts";
import { loadLocalEnv } from "./lib/cli.ts";

/** Fill missing previews from private, EXIF-free gallery derivatives only. */
const apply = process.argv.slice(2).includes("--apply");
if (process.argv.slice(2).some((arg) => arg !== "--apply")) {
	console.error("usage: node scripts/backfill-blur-placeholders.ts [--apply]");
	process.exit(2);
}
const env = loadLocalEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
const supabase = createClient(
	env.NEXT_PUBLIC_SUPABASE_URL,
	env.SUPABASE_SECRET_KEY,
	{ auth: { persistSession: false, autoRefreshToken: false } },
);

async function main() {
	let processed = 0;
	let page = 0;
	while (true) {
		const { data: rows, error } = await supabase
			.from("photos")
			.select("id,storage_path")
			.eq("hot_status", "uploaded")
			.eq("moderation_status", "approved")
			.is("blur_data_url", null)
			.order("id")
			.range(apply ? 0 : page * 50, (apply ? 0 : page * 50) + 49);
		if (error) throw error;
		if (!rows?.length) break;

		if (apply) {
			for (const row of rows) {
				const { data: derivative, error: downloadError } =
					await supabase.storage
						.from(GALLERY_BUCKET)
						.download(row.storage_path);
				if (downloadError || !derivative)
					throw downloadError ?? new Error("Missing derivative");
				const tiny = await sharp(Buffer.from(await derivative.arrayBuffer()))
					.resize({
						width: BLUR_IMAGE_SIZE,
						height: BLUR_IMAGE_SIZE,
						fit: "inside",
					})
					.jpeg({ quality: BLUR_IMAGE_QUALITY })
					.toBuffer();
				const preview = parseBlurDataUrl(
					`data:image/jpeg;base64,${tiny.toString("base64")}`,
				);
				if (!preview) throw new Error("Generated placeholder is invalid");
				const { data: updated, error: updateError } = await supabase
					.from("photos")
					.update({ blur_data_url: preview })
					.eq("id", row.id)
					.is("blur_data_url", null)
					.select("id");
				if (updateError) throw updateError;
				if (updated?.length !== 1)
					throw new Error("Backfill row was not updated");
				processed += 1;
			}
		} else {
			processed += rows.length;
			page += 1;
		}
	}
	console.log(
		`${apply ? "Backfilled" : "Would backfill"} ${processed} approved photo placeholders.`,
	);
}

main().catch((error: unknown) => {
	console.error(error instanceof Error ? error.message : "Backfill failed");
	process.exitCode = 1;
});
