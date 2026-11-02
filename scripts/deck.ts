#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
/**
 * Drive one site's slideshow deck from the command line, through the same
 * admin API the `/admin/pokaz` editor uses.
 *
 *   node scripts/deck.ts list
 *   node scripts/deck.ts set deck.json
 *   node scripts/deck.ts clear
 *
 * Reads SITE_ORIGIN (e.g. https://rosia.wianki.app) and
 * ADMIN_ACCESS_PASSPHRASE from the environment or from .secrets.deploy /
 * .env.local in the repo root.
 *
 * deck.json is a plain ordered array; the deck ends up matching it exactly:
 *
 *   [
 *     { "text": "Rosia & Piotrek", "subtitle": "Dziękujemy, że jesteście" },
 *     { "photo": "foto-001.jpg" },
 *     { "photo": "foto-002.jpg" }
 *   ]
 *
 * Photos are matched on the filename they were uploaded with. Run
 * `npm run photos:upload` first; `list` prints every name available. The
 * admin API titles text slides only, so a photo entry may not carry a
 * caption or subtitle.
 */
import type { AdminPhoto, AdminPhotoPage } from "../lib/admin.ts";
import type { AdminSlide } from "../lib/slideshow.ts";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "../lib/slideshow-protocol.ts";
import { errorMessage, loadLocalEnv } from "./lib/cli.ts";
import {
	jsonBody,
	loginSite,
	type SiteApi,
	siteOriginFromEnv,
} from "./lib/site-api.ts";

const [command, target] = process.argv.slice(2);

type DeckEntry = {
	photo?: string;
	text?: string;
	caption?: string;
	subtitle?: string;
};

type SlideSpec =
	| { kind: "photo"; photoId: string; name: string }
	| { kind: "text"; title: string; subtitle: string | null };

async function readDeck(api: SiteApi): Promise<AdminSlide[]> {
	const { slides } = await api.json<{ slides: AdminSlide[] }>(
		"/api/admin/slides",
	);
	return slides;
}

/** Every photo the gallery shows, oldest first, keyed by uploaded filename. */
async function listGalleryPhotos(api: SiteApi): Promise<AdminPhoto[]> {
	const photos: AdminPhoto[] = [];
	let cursor: string | null = null;
	do {
		const page: AdminPhotoPage = await api.json<AdminPhotoPage>(
			`/api/admin/photos${cursor ? `?cursor=${encodeURIComponent(cursor)}` : ""}`,
		);
		photos.push(...page.photos);
		cursor = page.nextCursor;
	} while (cursor);
	return photos
		.filter(
			(photo) =>
				photo.hotStatus === "uploaded" && photo.moderationStatus === "approved",
		)
		.reverse();
}

async function list(api: SiteApi) {
	const [deck, photos] = await Promise.all([
		readDeck(api),
		listGalleryPhotos(api),
	]);
	const nameById = new Map(photos.map((p) => [p.id, p.originalFilename]));
	console.log(`deck: ${deck.length} slide(s)`);
	for (const slide of deck) {
		const label =
			slide.kind === "text"
				? `text  "${slide.title}"${slide.subtitle ? ` / "${slide.subtitle}"` : ""}`
				: `photo ${(slide.photoId && nameById.get(slide.photoId)) ?? "(missing from gallery)"}${slide.title ? `  — "${slide.title}"` : ""}`;
		console.log(`  ${String(slide.position).padStart(3)}  ${label}`);
	}
	console.log(`\ngallery: ${photos.length} approved photo(s) available`);
	for (const photo of photos) console.log(`  ${photo.originalFilename}`);
}

async function removeAll(api: SiteApi) {
	const deck = await readDeck(api);
	for (const slide of deck) {
		await api.json(`/api/admin/slides/${slide.id}`, { method: "DELETE" });
	}
	return deck.length;
}

async function clear(api: SiteApi) {
	await removeAll(api);
	console.log("deck cleared — the show falls back to the whole gallery");
}

function planDeck(wanted: DeckEntry[], photos: AdminPhoto[]): SlideSpec[] {
	const byName = new Map(photos.map((p) => [p.originalFilename, p.id]));
	const specs: SlideSpec[] = [];
	const missing: string[] = [];
	const captioned: string[] = [];
	wanted.forEach((entry, index) => {
		const position = index + 1;
		if (entry.photo) {
			if (entry.caption || entry.subtitle) captioned.push(entry.photo);
			const id = byName.get(entry.photo);
			if (!id) {
				missing.push(entry.photo);
				return;
			}
			specs.push({ kind: "photo", photoId: id, name: entry.photo });
			return;
		}
		if (typeof entry.text === "string" && entry.text.trim()) {
			specs.push({
				kind: "text",
				title: entry.text.trim().slice(0, SLIDESHOW_MAX_TITLE),
				subtitle:
					entry.subtitle?.trim().slice(0, SLIDESHOW_MAX_SUBTITLE) || null,
			});
			return;
		}
		throw new Error(
			`entry ${position} needs either "photo" or "text": ${JSON.stringify(entry)}`,
		);
	});

	if (captioned.length) {
		console.error(
			"the admin API titles text slides only; drop caption/subtitle from:",
		);
		for (const name of captioned) console.error(`  ${name}`);
		process.exit(1);
	}
	if (missing.length) {
		console.error("not in the gallery (upload them first):");
		for (const name of missing) console.error(`  ${name}`);
		process.exit(1);
	}
	const photoIds = specs.flatMap((s) =>
		s.kind === "photo" ? [s.photoId] : [],
	);
	if (new Set(photoIds).size !== photoIds.length) {
		throw new Error("the same photo appears twice; each may be used once");
	}
	return specs;
}

async function set(api: SiteApi, file: string) {
	const wanted: DeckEntry[] = JSON.parse(await readFile(file, "utf8"));
	if (!Array.isArray(wanted) || wanted.length === 0) {
		throw new Error("deck file must be a non-empty array");
	}
	const specs = planDeck(wanted, await listGalleryPhotos(api));

	// The API appends; one call per entry, in order, is what makes the deck
	// come out in the order of the file. Clearing first keeps it exact.
	await removeAll(api);
	for (const spec of specs) {
		const body =
			spec.kind === "photo"
				? { photoIds: [spec.photoId] }
				: { title: spec.title, subtitle: spec.subtitle ?? undefined };
		const result = await api.json<{ added: number; skipped: number }>(
			"/api/admin/slides",
			{ method: "POST", ...jsonBody(body) },
		);
		if (result.added !== 1) {
			throw new Error(
				`the API did not add ${spec.kind === "photo" ? spec.name : `"${spec.title}"`} (added ${result.added}, skipped ${result.skipped})`,
			);
		}
	}

	const deck = await readDeck(api);
	if (deck.length !== specs.length) {
		throw new Error(
			`deck has ${deck.length} slide(s) after setting ${specs.length}; run \`list\``,
		);
	}
	console.log(
		`deck set: ${specs.length} slide(s) (${specs.filter((s) => s.kind === "photo").length} photo, ${specs.filter((s) => s.kind === "text").length} text)`,
	);
	console.log("reopen /pokaz to see it");
}

async function connect() {
	const env = loadLocalEnv(["SITE_ORIGIN", "ADMIN_ACCESS_PASSPHRASE"]);
	return loginSite(
		siteOriginFromEnv(env.SITE_ORIGIN),
		env.ADMIN_ACCESS_PASSPHRASE,
		"admin",
	);
}

try {
	if (command === "list") await list(await connect());
	else if (command === "clear") await clear(await connect());
	else if (command === "set" && target)
		await set(await connect(), path.resolve(target));
	else {
		console.error("usage: node scripts/deck.ts <list | set deck.json | clear>");
		process.exit(2);
	}
} catch (error) {
	console.error(errorMessage(error));
	process.exit(1);
}
