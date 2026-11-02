#!/usr/bin/env node
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
/**
 * Export one single-wedding Supabase deployment (the pre-platform schema in
 * git history under supabase/migrations) into files the platform can take.
 *
 *   node scripts/export-supabase.ts --site-id <id> --out <dir> [--dry-run]
 *       [--gallery-bucket wianki-gallery] [--originals-bucket wianki-originals]
 *
 * Reads SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL) and SUPABASE_SECRET_KEY
 * from the environment or from .secrets.deploy / .env.local in the repo
 * root. Talks to PostgREST and Storage over plain HTTP; nothing is written
 * to Supabase.
 *
 * Writes into --out:
 *   photos.sql        D1 inserts for upload_batches, photos, moderation_events,
 *                     slideshow_slides and slideshow_settings, all under the
 *                     target site id, timestamps as ISO strings, storage_path
 *                     unchanged, archive_key rewritten to the per-site layout
 *   derivatives/      every gallery derivative, at its storage_path
 *   derivatives.tsv   storage_path <tab> content type, for the upload loop
 *   originals.tsv     old R2 key <tab> new R2 key, for the copy loop
 *   README.txt        the exact wrangler commands to finish the move
 *
 * Originals are not downloaded: the operator copies the old bucket into the
 * new one under sites/<siteId>/originals/ (rclone or wrangler, see
 * README.txt) and photos.sql already points at the new keys. Photos that
 * never got a blur placeholder get one computed from their derivative.
 */
import { MAX_BLUR_DATA_URL_LENGTH } from "../lib/domain.ts";
import { encodeBlurPreview } from "./lib/blur-preview.ts";
import { errorMessage, loadLocalEnv } from "./lib/cli.ts";

type Json = string | number | boolean | null | Json[] | { [key: string]: Json };

type BatchRow = {
	id: string;
	guest_id: string;
	item_count: number;
	consent_version: string;
	created_at: string;
};

type PhotoRow = {
	id: string;
	batch_id: string;
	guest_id: string;
	original_filename: string;
	original_content_type: string;
	original_size: number;
	derivative_content_type: string | null;
	derivative_size: number | null;
	width: number | null;
	height: number | null;
	storage_path: string;
	archive_key: string | null;
	hot_status: string;
	archive_status: string;
	moderation_status: string;
	moderation_scores: Json;
	blur_data_url?: string | null;
	last_error: string | null;
	decided_at: string | null;
	created_at: string;
	updated_at: string;
};

type EventRow = {
	id: number;
	photo_id: string;
	actor: string;
	action: string;
	details: Json;
	created_at: string;
};

type SlideRow = {
	id: string;
	position: number;
	kind: string;
	photo_id: string | null;
	title: string | null;
	subtitle: string | null;
	created_at: string;
	updated_at: string;
};

type SettingsRow = { slide_seconds: number; updated_at: string };

const PAGE = 1000;
const LEGACY_ORIGINALS_PREFIX = "originals/";

const { values } = parseArgs({
	options: {
		"site-id": { type: "string" },
		out: { type: "string" },
		"dry-run": { type: "boolean", default: false },
		"gallery-bucket": { type: "string", default: "wianki-gallery" },
		"originals-bucket": { type: "string", default: "wianki-originals" },
	},
});

const siteId = values["site-id"] ?? "";
const outDir = values.out ?? "";
const dryRun = values["dry-run"];
const galleryBucket = values["gallery-bucket"];
const originalsBucket = values["originals-bucket"];

if (!/^[A-Za-z0-9-]{1,64}$/.test(siteId) || !outDir) {
	console.error(
		"usage: node scripts/export-supabase.ts --site-id <id> --out <dir> [--dry-run] [--gallery-bucket NAME] [--originals-bucket NAME]",
	);
	console.error(
		"  --site-id is the id of the site already created in the owner console (/konto)",
	);
	process.exit(2);
}

function supabase() {
	const env = loadLocalEnv(["SUPABASE_SECRET_KEY"]);
	const url = (
		process.env.SUPABASE_URL ??
		process.env.NEXT_PUBLIC_SUPABASE_URL ??
		""
	).replace(/\/$/, "");
	if (!url) {
		console.error("missing env: SUPABASE_URL (or NEXT_PUBLIC_SUPABASE_URL)");
		process.exit(2);
	}
	const headers = {
		apikey: env.SUPABASE_SECRET_KEY,
		Authorization: `Bearer ${env.SUPABASE_SECRET_KEY}`,
	};

	/** Reads a whole table through PostgREST, one page at a time. */
	async function rows<Row>(table: string, order: string): Promise<Row[]> {
		const all: Row[] = [];
		for (let offset = 0; ; offset += PAGE) {
			const response = await fetch(
				`${url}/rest/v1/${table}?select=*&order=${order}&limit=${PAGE}&offset=${offset}`,
				{ headers },
			);
			if (response.status === 404) {
				console.warn(`  table ${table} does not exist here; treating as empty`);
				return all;
			}
			if (!response.ok) {
				throw new Error(
					`${table}: HTTP ${response.status} ${await response.text()}`,
				);
			}
			const page = (await response.json()) as Row[];
			all.push(...page);
			if (page.length < PAGE) return all;
		}
	}

	async function object(storagePath: string) {
		const response = await fetch(
			`${url}/storage/v1/object/gallery/${storagePath.split("/").map(encodeURIComponent).join("/")}`,
			{ headers },
		);
		if (!response.ok) return null;
		return {
			bytes: Buffer.from(await response.arrayBuffer()),
			contentType:
				response.headers.get("content-type")?.split(";")[0].trim() ||
				"image/jpeg",
		};
	}

	return { rows, object };
}

/* ---------- SQL rendering ---------- */

function sqlString(value: string) {
	return `'${value.replace(/'/g, "''")}'`;
}

function sql(value: string | number | null | undefined) {
	if (value === null || value === undefined) return "NULL";
	if (typeof value === "number") {
		if (!Number.isFinite(value)) throw new Error(`bad number: ${value}`);
		return String(value);
	}
	return sqlString(value);
}

/** Postgres `timestamptz` text -> the ISO-with-milliseconds text D1 sorts. */
function iso(value: string | null) {
	if (value === null) return null;
	const parsed = new Date(value);
	if (Number.isNaN(parsed.getTime()))
		throw new Error(`bad timestamp: ${value}`);
	return parsed.toISOString();
}

function json(value: Json) {
	return value === null || value === undefined ? null : JSON.stringify(value);
}

function insert(table: string, columns: string[], values: string[]) {
	return `insert into ${table} (${columns.join(", ")}) values (${values.join(", ")});`;
}

/** `originals/<photoId>__<name>` -> `sites/<siteId>/originals/<photoId>__<name>`. */
function rewriteArchiveKey(key: string | null, site: string) {
	if (key === null) return { key: null, moved: false };
	if (!key.startsWith(LEGACY_ORIGINALS_PREFIX)) {
		// A Drive file id, not an R2 key: valid as-is only if the new
		// deployment also archives to Drive. Left alone, flagged in README.
		return { key, moved: false };
	}
	const basename = key.slice(key.lastIndexOf("/") + 1);
	return { key: `sites/${site}/originals/${basename}`, moved: true };
}

/* ---------- main ---------- */

async function main() {
	const db = supabase();
	console.log(`reading ${dryRun ? "(dry run) " : ""}from Supabase...`);
	const [batches, photos, events, slides, settings] = await Promise.all([
		db.rows<BatchRow>("upload_batches", "created_at.asc,id.asc"),
		db.rows<PhotoRow>("photos", "created_at.asc,id.asc"),
		db.rows<EventRow>("moderation_events", "id.asc"),
		db.rows<SlideRow>("slideshow_slides", "position.asc,created_at.asc"),
		db.rows<SettingsRow>("slideshow_settings", "updated_at.asc"),
	]);
	console.log(
		`  ${batches.length} batch(es), ${photos.length} photo(s), ${events.length} moderation event(s), ${slides.length} slide(s)`,
	);

	const withDerivative = photos.filter((p) => p.hot_status === "uploaded");
	const needsBlur = withDerivative.filter((p) => !p.blur_data_url);
	const originals: Array<[string, string]> = [];
	const driveKeys: string[] = [];
	for (const photo of photos) {
		const { key, moved } = rewriteArchiveKey(photo.archive_key, siteId);
		if (photo.archive_key && moved && key)
			originals.push([photo.archive_key, key]);
		else if (photo.archive_key && !moved) driveKeys.push(photo.archive_key);
	}
	console.log(
		`  ${withDerivative.length} derivative(s) to download, ${needsBlur.length} without a blur placeholder, ${originals.length} original(s) to copy${driveKeys.length ? `, ${driveKeys.length} Drive key(s) kept as-is` : ""}`,
	);

	if (dryRun) {
		for (const [from, to] of originals.slice(0, 5))
			console.log(`  ${from} -> ${to}`);
		if (originals.length > 5) console.log(`  ... ${originals.length - 5} more`);
		console.log("dry run: nothing written");
		return;
	}

	const out = path.resolve(outDir);
	await mkdir(path.join(out, "derivatives"), { recursive: true });

	// Derivatives first: the blur placeholder of a photo that never had one is
	// computed from the bytes just downloaded, and goes into photos.sql.
	const derivativesTsv: string[] = [];
	const blur = new Map<string, string>();
	let missing = 0;
	for (const [index, photo] of withDerivative.entries()) {
		const object = await db.object(photo.storage_path);
		if (!object) {
			missing++;
			console.warn(`  missing derivative: ${photo.storage_path} (${photo.id})`);
			continue;
		}
		const target = path.join(out, "derivatives", photo.storage_path);
		await mkdir(path.dirname(target), { recursive: true });
		await writeFile(target, object.bytes);
		derivativesTsv.push(`${photo.storage_path}\t${object.contentType}`);
		if (!photo.blur_data_url) {
			try {
				const preview = await encodeBlurPreview(object.bytes);
				if (preview.length <= MAX_BLUR_DATA_URL_LENGTH)
					blur.set(photo.id, preview);
			} catch (error) {
				console.warn(
					`  no placeholder for ${photo.id}: ${errorMessage(error)}`,
				);
			}
		}
		if ((index + 1) % 50 === 0)
			console.log(`  ${index + 1}/${withDerivative.length} derivatives`);
	}
	console.log(
		`  ${derivativesTsv.length} derivative(s) saved${missing ? `, ${missing} missing in Storage` : ""}, ${blur.size} placeholder(s) computed`,
	);

	const lines: string[] = [
		`-- Generated by scripts/export-supabase.ts on ${new Date().toISOString()}`,
		`-- Target site: ${siteId}. Create the site in /konto first; every row below references it.`,
		"-- Apply with: wrangler d1 execute DB --remote --file photos.sql",
		"",
	];
	for (const b of batches) {
		lines.push(
			insert(
				"upload_batches",
				[
					"id",
					"site_id",
					"guest_id",
					"item_count",
					"consent_version",
					"created_at",
				],
				[
					sql(b.id),
					sql(siteId),
					sql(b.guest_id),
					sql(b.item_count),
					sql(b.consent_version),
					sql(iso(b.created_at)),
				],
			),
		);
	}
	for (const p of photos) {
		lines.push(
			insert(
				"photos",
				[
					"id",
					"site_id",
					"batch_id",
					"guest_id",
					"original_filename",
					"original_content_type",
					"original_size",
					"derivative_content_type",
					"derivative_size",
					"width",
					"height",
					"storage_path",
					"archive_key",
					"hot_status",
					"archive_status",
					"moderation_status",
					"moderation_scores",
					"blur_data_url",
					"last_error",
					"decided_at",
					"created_at",
					"updated_at",
				],
				[
					sql(p.id),
					sql(siteId),
					sql(p.batch_id),
					sql(p.guest_id),
					sql(p.original_filename),
					sql(p.original_content_type),
					sql(p.original_size),
					sql(p.derivative_content_type),
					sql(p.derivative_size),
					sql(p.width),
					sql(p.height),
					sql(p.storage_path),
					sql(rewriteArchiveKey(p.archive_key, siteId).key),
					sql(p.hot_status),
					sql(p.archive_status),
					sql(p.moderation_status),
					sql(json(p.moderation_scores)),
					sql(p.blur_data_url ?? blur.get(p.id) ?? null),
					sql(p.last_error),
					sql(iso(p.decided_at)),
					sql(iso(p.created_at)),
					sql(iso(p.updated_at)),
				],
			),
		);
	}
	for (const e of events) {
		// The old bigint identity is dropped; D1 assigns its own autoincrement.
		lines.push(
			insert(
				"moderation_events",
				["photo_id", "actor", "action", "details", "created_at"],
				[
					sql(e.photo_id),
					sql(e.actor),
					sql(e.action),
					sql(json(e.details)),
					sql(iso(e.created_at)),
				],
			),
		);
	}
	for (const s of slides) {
		lines.push(
			insert(
				"slideshow_slides",
				[
					"id",
					"site_id",
					"position",
					"kind",
					"photo_id",
					"title",
					"subtitle",
					"created_at",
					"updated_at",
				],
				[
					sql(s.id),
					sql(siteId),
					sql(s.position),
					sql(s.kind),
					sql(s.photo_id),
					sql(s.title),
					sql(s.subtitle),
					sql(iso(s.created_at)),
					sql(iso(s.updated_at)),
				],
			),
		);
	}
	const tempo = settings.at(-1);
	if (tempo) {
		lines.push(
			`insert into slideshow_settings (site_id, slide_seconds, updated_at) values (${sql(siteId)}, ${sql(tempo.slide_seconds)}, ${sql(iso(tempo.updated_at))}) on conflict (site_id) do update set slide_seconds = excluded.slide_seconds, updated_at = excluded.updated_at;`,
		);
	}
	await writeFile(path.join(out, "photos.sql"), `${lines.join("\n")}\n`);
	await writeFile(
		path.join(out, "derivatives.tsv"),
		derivativesTsv.length ? `${derivativesTsv.join("\n")}\n` : "",
	);
	await writeFile(
		path.join(out, "originals.tsv"),
		originals.length
			? `${originals.map((pair) => pair.join("\t")).join("\n")}\n`
			: "",
	);
	await writeFile(path.join(out, "README.txt"), readme(driveKeys));
	console.log(`written to ${out}; follow README.txt there`);
}

function readme(driveKeys: string[]) {
	return `Moving this wedding into the platform — site ${siteId}

Run every step from this directory. "DB" is the D1 binding name the app
uses (alchemy.run.ts); pass the database name instead if wrangler asks.

1. The site must already exist in the owner console (/konto) with the id
   above, and its slug or custom domain must be what guests will use.

2. Derivatives -> gallery bucket, under sites/${siteId}/<storage_path>:

   while IFS=$'\\t' read -r storage_path content_type; do
     npx wrangler r2 object put "${galleryBucket}/sites/${siteId}/$storage_path" \\
       --file "derivatives/$storage_path" --content-type "$content_type" --remote
   done < derivatives.tsv

3. Originals -> originals bucket. Nothing was downloaded; copy the old
   wedding-originals bucket into the new one under the site prefix. With
   rclone (both buckets configured as S3 remotes):

   rclone copy old-r2:wedding-originals/originals/ \\
     new-r2:${originalsBucket}/sites/${siteId}/originals/

   Or, per object, with wrangler (originals.tsv lists old key -> new key):

   while IFS=$'\\t' read -r old_key new_key; do
     npx wrangler r2 object get "wedding-originals/$old_key" --file /tmp/original --remote
     npx wrangler r2 object put "${originalsBucket}/$new_key" --file /tmp/original --remote
   done < originals.tsv
${
	driveKeys.length
		? `
   ${driveKeys.length} photo(s) have a Google Drive file id as archive_key,
   not an R2 key. They were left unchanged and stay valid only if the new
   deployment also runs the archive Worker with ARCHIVE_BACKEND=drive on
   the same folder. Otherwise set their archive_status to 'failed' after
   import and re-archive from the originals.
`
		: ""
}
4. Rows -> D1 (photos.sql already carries the new archive keys):

   npx wrangler d1 execute DB --remote --file photos.sql

   A very large wedding may exceed one execute; split photos.sql by table
   (the inserts are grouped in dependency order) and run the parts in order.

5. Open the site, log in as admin and check /admin and the gallery. Only
   then retire the Supabase project.
`;
}

main().catch((error) => {
	console.error(errorMessage(error));
	process.exit(1);
});
