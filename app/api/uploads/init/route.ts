import { z } from "zod";
import { createArchiveToken } from "@/lib/archive-token";
import { readGuestSession } from "@/lib/auth/session";
import { batch, first } from "@/lib/db";
import {
	acceptedOriginalTypes,
	MAX_BATCH_FILES,
	MAX_ORIGINAL_BYTES,
	TRIAL_PHOTO_LIMIT,
} from "@/lib/domain";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { siteAcceptsUploads, siteFromRequest } from "@/lib/sites";

const fileSchema = z.object({
	name: z.string().min(1).max(180),
	type: z.enum(acceptedOriginalTypes),
	size: z.number().int().positive().max(MAX_ORIGINAL_BYTES),
});

const requestSchema = z.object({
	consent: z.literal(true),
	files: z.array(fileSchema).min(1).max(MAX_BATCH_FILES),
});

function safeFilename(name: string) {
	const cleaned = name
		.normalize("NFKD")
		.replace(/[^\w.-]+/g, "-")
		.replace(/-+/g, "-")
		.replace(/^[-.]+|[-.]+$/g, "");
	return cleaned.slice(0, 120) || "zdjecie";
}

export async function POST(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const session = await readGuestSession(site);
	if (!session) return jsonError("Sesja gościa wygasła.", 401);
	try {
		assertSameOrigin(request, site.origin);
	} catch (response) {
		return response as Response;
	}
	if (!siteAcceptsUploads(site)) {
		return jsonError("Ta galeria nie przyjmuje już zdjęć.", 403);
	}

	const parsed = requestSchema.safeParse(
		await request.json().catch(() => null),
	);
	if (!parsed.success) {
		return jsonError("Wybierz od 1 do 10 obsługiwanych zdjęć.", 400);
	}

	// A trial site is for trying: it stops at a modest number of photos until
	// the owner pays. A paid site has no cap; heavy use is metered instead.
	if (site.plan_status === "trial") {
		const used = await first<{ count: number }>(
			"select count(*) as count from photos where site_id = ? and hot_status <> 'deleted'",
			[site.id],
		);
		if ((used?.count ?? 0) + parsed.data.files.length > TRIAL_PHOTO_LIMIT) {
			return jsonError(
				"Ta galeria jest w wersji próbnej i osiągnęła limit zdjęć. Para młoda musi ją opłacić, aby przyjąć więcej.",
				402,
			);
		}
	}

	const batchId = crypto.randomUUID();
	const rows = parsed.data.files.map((file) => {
		const id = crypto.randomUUID();
		return {
			id,
			original_filename: safeFilename(file.name),
			original_content_type: file.type,
			original_size: file.size,
			storage_path: `${batchId}/${id}.jpg`,
		};
	});

	try {
		await batch([
			{
				sql: "insert into upload_batches (id, site_id, guest_id, item_count, consent_version) values (?, ?, ?, ?, ?)",
				params: [
					batchId,
					site.id,
					session.guestId,
					rows.length,
					site.consent_version,
				],
			},
			...rows.map((row) => ({
				sql: `insert into photos (id, site_id, batch_id, guest_id, original_filename,
				        original_content_type, original_size, storage_path)
				      values (?, ?, ?, ?, ?, ?, ?, ?)`,
				params: [
					row.id,
					site.id,
					batchId,
					session.guestId,
					row.original_filename,
					row.original_content_type,
					row.original_size,
					row.storage_path,
				],
			})),
		]);
	} catch {
		return jsonError("Nie udało się rozpocząć wysyłania.", 500);
	}

	try {
		const uploads = await Promise.all(
			rows.map(async (row, index) => ({
				photoId: row.id,
				archiveToken: await createArchiveToken({
					photoId: row.id,
					siteId: site.id,
					origin: site.origin,
					operation: "upload",
					filename: row.original_filename,
					contentType: parsed.data.files[index].type,
					size: parsed.data.files[index].size,
				}),
			})),
		);
		return noStoreJson({ batchId, uploads });
	} catch {
		await batch([
			{ sql: "delete from photos where batch_id = ?", params: [batchId] },
			{ sql: "delete from upload_batches where id = ?", params: [batchId] },
		]);
		return jsonError(
			"Nie udało się utworzyć bezpiecznych adresów wysyłki.",
			500,
		);
	}
}
