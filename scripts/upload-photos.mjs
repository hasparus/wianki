#!/usr/bin/env node
import { readdir, readFile, stat } from "node:fs/promises";
import path from "node:path";
/**
 * Bulk-upload photos from disk through the real guest pipeline.
 *
 *   node scripts/upload-photos.mjs <file-or-dir>... [--dry-run] [--concurrency N]
 *
 * Reads APP_ORIGIN, GUEST_ACCESS_PASSPHRASE and the Supabase public keys from
 * the environment or from .secrets.deploy / .env.local in the repo root.
 *
 * It deliberately drives the same HTTP endpoints a phone would, so uploaded
 * photos land in exactly the same state as guest uploads: EXIF-free derivative
 * in Supabase, full original in R2, one row per photo. Nothing writes to the
 * database directly.
 */
import { createClient } from "@supabase/supabase-js";
import sharp from "sharp";

const MAX_BATCH_FILES = 10;
const MAX_ORIGINAL_BYTES = 25 * 1024 * 1024;
const MAX_DERIVATIVE_BYTES = 500 * 1024;
const IMAGE_EXT = new Set([".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif"]);
const CONTENT_TYPE = {
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".png": "image/png",
	".webp": "image/webp",
	".heic": "image/heic",
	".heif": "image/heif",
};

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const concurrency = Number(
	args[args.indexOf("--concurrency") + 1] > 0
		? args[args.indexOf("--concurrency") + 1]
		: 4,
);
const inputs = args.filter((a, i) => {
	if (a.startsWith("--")) return false;
	return args[i - 1] !== "--concurrency";
});

if (inputs.length === 0) {
	console.error(
		"usage: node scripts/upload-photos.mjs <file-or-dir>... [--dry-run] [--concurrency N]",
	);
	process.exit(2);
}

async function loadEnv() {
	const root = path.resolve(import.meta.dirname, "..");
	for (const name of [".secrets.deploy", ".env.local"]) {
		try {
			const text = await readFile(path.join(root, name), "utf8");
			for (const line of text.split("\n")) {
				const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
				if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
			}
		} catch {}
	}
	const missing = [
		"APP_ORIGIN",
		"GUEST_ACCESS_PASSPHRASE",
		"NEXT_PUBLIC_SUPABASE_URL",
		"NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
	].filter((k) => !process.env[k]);
	if (missing.length) {
		console.error("missing env: " + missing.join(", "));
		process.exit(2);
	}
}

async function collect(target) {
	const info = await stat(target);
	if (info.isFile()) {
		return IMAGE_EXT.has(path.extname(target).toLowerCase()) ? [target] : [];
	}
	const found = [];
	for (const entry of await readdir(target, { withFileTypes: true })) {
		if (entry.name.startsWith(".")) continue;
		found.push(...(await collect(path.join(target, entry.name))));
	}
	return found;
}

/** Mirrors the browser: max 1920px, JPEG, EXIF dropped, under 500 KiB. */
async function makeDerivative(file) {
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
			return { buffer, width: meta.width, height: meta.height };
		}
		quality -= 8;
	}
	throw new Error("could not compress under 500 KiB");
}

async function login(origin) {
	const form = new FormData();
	form.set("passphrase", process.env.GUEST_ACCESS_PASSPHRASE);
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

async function uploadOne(origin, cookie, supabase, file, init) {
	const original = await readFile(file);
	const derivative = await makeDerivative(file);

	const { error: storageError } = await supabase.storage
		.from("gallery")
		.uploadToSignedUrl(init.path, init.uploadToken, derivative.buffer, {
			contentType: "image/jpeg",
			cacheControl: "3600",
		});
	if (storageError) throw new Error(`gallery copy: ${storageError.message}`);

	let archiveReceipt = null;
	let archiveError = null;
	try {
		const response = await fetch(
			`${process.env.NEXT_PUBLIC_ARCHIVE_WORKER_URL}/v1/archive/${init.photoId}`,
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
		const body = await response.json().catch(() => ({}));
		if (response.ok) archiveReceipt = body.receipt ?? null;
		else archiveError = body.error ?? `archive HTTP ${response.status}`;
	} catch (error) {
		archiveError = String(error.message ?? error).slice(0, 200);
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
		const body = await finalize.json().catch(() => ({}));
		throw new Error(body.error ?? `finalize HTTP ${finalize.status}`);
	}
	return { archived: Boolean(archiveReceipt), archiveError };
}

async function main() {
	await loadEnv();
	const origin = process.env.APP_ORIGIN.replace(/\/$/, "");

	const files = [];
	for (const input of inputs)
		files.push(...(await collect(path.resolve(input))));
	files.sort();

	const usable = [];
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

	console.log(`${usable.length} photo(s) to upload -> ${origin}`);
	if (dryRun) {
		for (const f of usable) console.log("  " + f);
		return;
	}
	if (usable.length === 0) return;

	const cookie = await login(origin);
	const supabase = createClient(
		process.env.NEXT_PUBLIC_SUPABASE_URL,
		process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
		{ auth: { persistSession: false, autoRefreshToken: false } },
	);

	let done = 0;
	let failed = 0;
	let unarchived = 0;

	for (let i = 0; i < usable.length; i += MAX_BATCH_FILES) {
		const batch = usable.slice(i, i + MAX_BATCH_FILES);
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
		const body = await response.json().catch(() => ({}));
		if (!response.ok || !body.uploads) {
			console.error(`  batch failed: ${body.error ?? response.status}`);
			failed += batch.length;
			continue;
		}

		let cursor = 0;
		await Promise.all(
			Array.from({ length: Math.min(concurrency, batch.length) }, async () => {
				while (cursor < batch.length) {
					const index = cursor++;
					const file = batch[index];
					try {
						const result = await uploadOne(
							origin,
							cookie,
							supabase,
							file,
							body.uploads[index],
						);
						done++;
						if (!result.archived) unarchived++;
						const mark = result.archived ? "ok  " : "warn";
						console.log(
							`  ${mark}  ${path.basename(file)}${result.archiveError ? "  (archive: " + result.archiveError + ")" : ""}`,
						);
					} catch (error) {
						failed++;
						console.error(`  fail  ${path.basename(file)}: ${error.message}`);
					}
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
