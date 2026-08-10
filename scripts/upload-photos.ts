#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { parseArgs } from "node:util";
/**
 * Bulk-upload photos from disk through the real guest pipeline.
 *
 *   node scripts/upload-photos.ts <file-or-dir>... [--dry-run] [--concurrency N]
 *
 * Reads APP_ORIGIN, GUEST_ACCESS_PASSPHRASE and the Supabase public keys from
 * the environment or from .secrets.deploy / .env.local in the repo root.
 *
 * It deliberately drives the same HTTP endpoints a phone would, so uploaded
 * photos land in exactly the same state as guest uploads: EXIF-free derivative
 * in Supabase, full original in R2, one row per photo. Nothing writes to the
 * database directly.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import sharp from "sharp";
import {
	MAX_BATCH_FILES,
	MAX_DERIVATIVE_BYTES,
	MAX_ORIGINAL_BYTES,
} from "../lib/domain.ts";
import { errorMessage, loadLocalEnv } from "./lib/cli.ts";

type UploadInit = {
	photoId: string;
	path: string;
	uploadToken: string;
	archiveToken: string;
};

/** These endpoints answer with JSON on success and on failure alike. */
type ApiBody = {
	error?: string;
	receipt?: string;
	uploads?: UploadInit[];
};

async function readJson(response: Response): Promise<ApiBody> {
	return (await response.json().catch(() => ({}))) as ApiBody;
}

const CONTENT_TYPE: Record<string, string> = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".heic": "image/heic",
	".heif": "image/heif",
};
const IMAGE_EXT = new Set(Object.keys(CONTENT_TYPE));

const { values, positionals: inputs } = parseArgs({
	allowPositionals: true,
	options: {
		"dry-run": { type: "boolean", default: false },
		fast: { type: "boolean", default: false },
		concurrency: { type: "string", default: "4" },
	},
});
const dryRun = values["dry-run"];
// Photos land in the gallery ordered by created_at, and a multi-row insert
// stamps every row in the batch with the same transaction time — so batching
// randomises order within each group of ten. One init per photo keeps the
// order you passed them in. --fast trades that away for throughput.
const fast = values.fast;
const concurrency = Math.max(1, Number(values.concurrency) || 4);

if (inputs.length === 0) {
	console.error(
		"usage: node scripts/upload-photos.ts <file-or-dir>... [--dry-run] [--fast] [--concurrency N]",
	);
	process.exit(2);
}

async function collect(target: string): Promise<string[]> {
	const info = await stat(target);
	if (info.isFile()) {
		return IMAGE_EXT.has(path.extname(target).toLowerCase()) ? [target] : [];
	}
	const found: string[] = [];
	for (const entry of await readdir(target, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		found.push(...(await collect(path.join(target, entry.name))));
	}
	return found;
}

/** Mirrors the browser: max 1920px, JPEG, EXIF dropped, under 500 KiB. */
async function makeDerivative(file: string) {
	let quality = 82;
	for (let attempt = 0; attempt < 6; attempt++) {
		const buffer = await sharp(file)
			.rotate()
			.resize({
				width: 1920,
				height: 1920,
				fit: "inside",
				withoutEnlargement: true,
			})
			.jpeg({ quality, mozjpeg: true })
			.toBuffer();
		if (buffer.length <= MAX_DERIVATIVE_BYTES || quality <= 40) {
			const meta = await sharp(buffer).metadata();
			return { buffer, width: meta.width ?? null, height: meta.height ?? null };
		}
		quality -= 8;
	}
	throw new Error("could not compress under 500 KiB");
}

async function login(origin: string, passphrase: string) {
	const form = new FormData();
	form.set("passphrase", passphrase);
	const response = await fetch(`${origin}/api/auth/guest`, {
		method: "POST",
		headers: { Origin: origin },
		body: form,
		redirect: "manual",
	});
	if (!response.ok) throw new Error(`login failed (${response.status})`);
	const cookie = response.headers
		.getSetCookie()
		.map((c) => c.split(";")[0])
		.join("; ");
	if (!cookie.includes("wedding_guest")) throw new Error("no guest cookie");
	return cookie;
}

async function uploadOne(
	origin: string,
	cookie: string,
	supabase: SupabaseClient,
	archiveWorkerUrl: string,
	file: string,
	init: UploadInit,
) {
	const original = await readFile(file);
	const derivative = await makeDerivative(file);

	const { error: storageError } = await supabase.storage
		.from("gallery")
		.uploadToSignedUrl(init.path, init.uploadToken, derivative.buffer, {
			contentType: "image/jpeg",
			cacheControl: "3600",
		});
	if (storageError) throw new Error(`gallery copy: ${storageError.message}`);

	let archiveReceipt: string | null = null;
	let archiveError: string | null = null;
	try {
		const response = await fetch(
			`${archiveWorkerUrl}/v1/archive/${init.photoId}`,
			{
				method: "PUT",
				headers: {
					Authorization: `Bearer ${init.archiveToken}`,
					"Content-Type":
						CONTENT_TYPE[path.extname(file).toLowerCase()] ||
						"application/octet-stream",
					Origin: origin,
					"Content-Length": String(original.length),
				},
				body: original,
			},
		);
		const body = await readJson(response);
		if (response.ok) archiveReceipt = body.receipt ?? null;
		else archiveError = body.error ?? `archive HTTP ${response.status}`;
	} catch (error) {
		archiveError = errorMessage(error).slice(0, 200);
	}

	const finalize = await fetch(
		`${origin}/api/uploads/${init.photoId}/finalize`,
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: origin,
				Cookie: cookie,
			},
			body: JSON.stringify({
				archiveReceipt,
				archiveError,
				derivativeSize: derivative.buffer.length,
				derivativeType: "image/jpeg",
				width: derivative.width,
				height: derivative.height,
			}),
		},
	);
	if (!finalize.ok) {
		const body = await readJson(finalize);
		throw new Error(body.error ?? `finalize HTTP ${finalize.status}`);
	}
	return { archived: Boolean(archiveReceipt), archiveError };
}

async function main() {
	const env = loadLocalEnv([
		"APP_ORIGIN",
		"GUEST_ACCESS_PASSPHRASE",
		"NEXT_PUBLIC_SUPABASE_URL",
		"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
		"NEXT_PUBLIC_ARCHIVE_WORKER_URL",
	]);
	const origin = env.APP_ORIGIN.replace(/\/$/, "");

	const files: string[] = [];
	for (const input of inputs)
		files.push(...(await collect(path.resolve(input))));
	files.sort();

	const usable: string[] = [];
	for (const file of files) {
		const { size } = await stat(file);
		if (size > MAX_ORIGINAL_BYTES) {
			console.log(
				`  skip  ${path.basename(file)} (${(size / 1048576).toFixed(1)} MB > 25 MB)`,
			);
			continue;
		}
		usable.push(file);
	}

	console.log(
		`${usable.length} photo(s) to upload -> ${origin}` +
			(fast ? "  (--fast: order not preserved)" : "  (in filename order)"),
	);
	if (dryRun) {
		for (const f of usable) console.log(`  ${f}`);
		return;
	}
	if (usable.length === 0) return;

	const cookie = await login(origin, env.GUEST_ACCESS_PASSPHRASE);
	const supabase = createClient(
		env.NEXT_PUBLIC_SUPABASE_URL,
		env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);

	let done = 0;
	let failed = 0;
	let unarchived = 0;

	async function initBatch(batch: string[]): Promise<UploadInit[]> {
		const meta = await Promise.all(
			batch.map(async (file) => ({
				name: path.basename(file),
				type: CONTENT_TYPE[path.extname(file).toLowerCase()] || "image/jpeg",
				size: (await stat(file)).size,
			})),
		);
		const response = await fetch(`${origin}/api/uploads/init`, {
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: origin,
				Cookie: cookie,
			},
			body: JSON.stringify({ consent: true, files: meta }),
		});
		const body = await readJson(response);
		if (!response.ok || !body.uploads) {
			throw new Error(body.error ?? `init HTTP ${response.status}`);
		}
		return body.uploads;
	}

	async function send(file: string, init: UploadInit) {
		try {
			const result = await uploadOne(
				origin,
				cookie,
				supabase,
				env.NEXT_PUBLIC_ARCHIVE_WORKER_URL,
				file,
				init,
			);
			done++;
			if (!result.archived) unarchived++;
			console.log(
				`  ${result.archived ? "ok  " : "warn"}  ${path.basename(file)}${result.archiveError ? `  (archive: ${result.archiveError})` : ""}`,
			);
		} catch (error) {
			failed++;
			console.error(`  fail  ${path.basename(file)}: ${errorMessage(error)}`);
		}
	}

	// --fast batches ten photos per init call, which is faster but lets the
	// database stamp a whole batch with one created_at, randomising gallery
	// order inside each group. One per init keeps the order you passed.
	const groupSize = fast ? MAX_BATCH_FILES : 1;
	for (let i = 0; i < usable.length; i += groupSize) {
		const batch = usable.slice(i, i + groupSize);
		let uploads: UploadInit[];
		try {
			uploads = await initBatch(batch);
		} catch (error) {
			console.error(`  batch failed: ${errorMessage(error)}`);
			failed += batch.length;
			continue;
		}
		let cursor = 0;
		await Promise.all(
			Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
				while (cursor < batch.length) {
					const index = cursor++;
					await send(batch[index], uploads[index]);
				}
			}),
		);
	}

	console.log(
		`\ndone: ${done} uploaded, ${failed} failed${unarchived ? `, ${unarchived} without an archived original` : ""}`,
	);
	process.exit(failed ? 1 : 0);
}

main().catch((error) => {
	console.error(error);
	process.exit(1);
});
