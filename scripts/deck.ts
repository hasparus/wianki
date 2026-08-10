#!/usr/bin/env node
import { readFile } from "node:fs/promises";
import path from "node:path";
/**
 * Drive the slideshow deck from the command line.
 *
 *   node scripts/deck.ts list
 *   node scripts/deck.ts set deck.json
 *   node scripts/deck.ts clear
 *
 * deck.json is a plain ordered array; the deck ends up matching it exactly:
 *
 *   [
 *     { "text": "Paweł & Magdalena", "subtitle": "Dziękujemy, że jesteście" },
 *     { "photo": "foto-001.jpg", "caption": "Pierwsze wakacje", "subtitle": "2019" },
 *     { "photo": "foto-002.jpg" }
 *   ]
 *
 * Photos are matched on the filename they were uploaded with. Run
 * `npm run photos:upload` first; `list` prints every name available.
 */
import { createClient } from "@supabase/supabase-js";
import {
	SLIDESHOW_MAX_SUBTITLE,
	SLIDESHOW_MAX_TITLE,
} from "../lib/slideshow-protocol.ts";
import { errorMessage, loadLocalEnv } from "./lib/cli.ts";

const [command, target] = process.argv.slice(2);

function connect() {
	const env = loadLocalEnv(["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SECRET_KEY"]);
	return createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
		auth: { persistSession: false, autoRefreshToken: false },
	});
}

type Db = ReturnType<typeof connect>;

type DeckEntry = {
	photo?: string;
	text?: string;
	caption?: string;
	subtitle?: string;
};

type SlideInsert = {
	position: number;
	kind: "photo" | "text";
	photo_id?: string;
	title: string | null;
	subtitle: string | null;
};

type DeckRow = {
	id: string;
	position: number;
	kind: "photo" | "text";
	title: string | null;
	subtitle: string | null;
	photo_id: string | null;
	photos: { original_filename: string } | null;
};

async function readDeck(db: Db): Promise<DeckRow[]> {
	const { data, error } = await db
		.from("slideshow_slides")
		.select(
			"id,position,kind,title,subtitle,photo_id,photos(original_filename)",
		)
		.order("position", { ascending: true });
	if (error) throw error;
	return (data ?? []) as unknown as DeckRow[];
}

async function listGalleryPhotos(db: Db) {
	const { data, error } = await db
		.from("photos")
		.select("id,original_filename,hot_status,moderation_status")
		.eq("hot_status", "uploaded")
		.eq("moderation_status", "approved")
		.order("created_at", { ascending: true })
		.order("id", { ascending: true });
	if (error) throw error;
	return data ?? [];
}

async function list(db: Db) {
	const [deck, photos] = await Promise.all([
		readDeck(db),
		listGalleryPhotos(db),
	]);
	console.log(`deck: ${deck.length} slide(s)`);
	for (const slide of deck) {
		const label =
			slide.kind === "text"
				? `text  "${slide.title}"${slide.subtitle ? ` / "${slide.subtitle}"` : ""}`
				: `photo ${slide.photos?.original_filename ?? "(missing from gallery)"}${slide.title ? `  — "${slide.title}"` : ""}`;
		console.log(`  ${String(slide.position).padStart(3)}  ${label}`);
	}
	console.log(`\ngallery: ${photos.length} approved photo(s) available`);
	for (const photo of photos) console.log(`  ${photo.original_filename}`);
}

async function clear(db: Db) {
	const { error } = await db
		.from("slideshow_slides")
		.delete()
		.not("id", "is", null);
	if (error) throw error;
	console.log("deck cleared — the show falls back to the whole gallery");
}

async function set(db: Db, file: string) {
	const wanted: DeckEntry[] = JSON.parse(await readFile(file, "utf8"));
	if (!Array.isArray(wanted) || wanted.length === 0) {
		throw new Error("deck file must be a non-empty array");
	}

	const photos = await listGalleryPhotos(db);
	const byName = new Map(photos.map((p) => [p.original_filename, p.id]));

	const rows: SlideInsert[] = [];
	const missing: string[] = [];
	wanted.forEach((entry, index) => {
		const position = index + 1;
		if (entry.photo) {
			const id = byName.get(entry.photo);
			if (!id) {
				missing.push(entry.photo);
				return;
			}
			rows.push({
				position,
				kind: "photo",
				photo_id: id,
				title: entry.caption?.trim().slice(0, SLIDESHOW_MAX_TITLE) || null,
				subtitle:
					entry.subtitle?.trim().slice(0, SLIDESHOW_MAX_SUBTITLE) || null,
			});
			return;
		}
		if (typeof entry.text === "string" && entry.text.trim()) {
			rows.push({
				position,
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

	if (missing.length) {
		console.error(`not in the gallery (upload them first):`);
		for (const name of missing) console.error(`  ${name}`);
		process.exit(1);
	}

	const duplicates = rows
		.filter((r) => r.photo_id)
		.map((r) => r.photo_id)
		.filter((id, i, all) => all.indexOf(id) !== i);
	if (duplicates.length) {
		throw new Error("the same photo appears twice; each may be used once");
	}

	const { error: clearError } = await db
		.from("slideshow_slides")
		.delete()
		.not("id", "is", null);
	if (clearError) throw clearError;

	const { error: insertError } = await db
		.from("slideshow_slides")
		.insert(rows.map((row, index) => ({ ...row, position: index + 1 })));
	if (insertError) throw insertError;

	console.log(
		`deck set: ${rows.length} slide(s) (${rows.filter((r) => r.kind === "photo").length} photo, ${rows.filter((r) => r.kind === "text").length} text)`,
	);
	console.log("reopen /pokaz to see it");
}

const db = connect();
try {
	if (command === "list") await list(db);
	else if (command === "clear") await clear(db);
	else if (command === "set" && target) await set(db, path.resolve(target));
	else {
		console.error("usage: node scripts/deck.ts <list | set deck.json | clear>");
		process.exit(2);
	}
} catch (error) {
	console.error(errorMessage(error));
	process.exit(1);
}
