#!/usr/bin/env node
import { createClient } from "@supabase/supabase-js";
import {
	backfillBlurPlaceholders,
	previewBackfillStore,
} from "./lib/backfill-blur-placeholders.ts";
import { loadLocalEnv } from "./lib/cli.ts";

/** Rebuild missing previews from private, EXIF-free derivatives; dry-run by default. */
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

backfillBlurPlaceholders(previewBackfillStore(supabase), apply)
	.then((count) => {
		console.log(
			`${apply ? "Backfilled" : "Would backfill"} ${count} approved photo placeholders.`,
		);
	})
	.catch((error: unknown) => {
		console.error(error instanceof Error ? error.message : "Backfill failed");
		process.exitCode = 1;
	});
