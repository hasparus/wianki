import { after } from "next/server";
import { z } from "zod";
import { createArchiveToken, verifyArchiveReceipt } from "@/lib/archive-token";
import { denyAdminRequest } from "@/lib/auth/session";
import { syncStorageUsage } from "@/lib/billing";
import { first, nowIso, run } from "@/lib/db";
import type { ArchiveStatus } from "@/lib/domain";
import { moderationConfigured, serverEnv } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";
import { moderateImage } from "@/lib/moderation";
import { type Site, siteFromRequest } from "@/lib/sites";
import { deleteDerivative, derivativeBlob, derivativeKey } from "@/lib/storage";

const actionSchema = z.object({
	action: z.enum(["approve", "hide", "retry_moderation", "reconcile_archive"]),
});

type PhotoRow = {
	id: string;
	storage_path: string;
	archive_key: string | null;
	original_size: number;
};

async function photoById(siteId: string, photoId: string) {
	return first<PhotoRow>(
		"select id, storage_path, archive_key, original_size from photos where id = ? and site_id = ?",
		[photoId, siteId],
	);
}

async function recordEvent(
	photoId: string,
	actor: "vision" | "admin" | "system",
	action: string,
	details: unknown = null,
) {
	await run(
		"insert into moderation_events (photo_id, actor, action, details) values (?, ?, ?, ?)",
		[photoId, actor, action, details === null ? null : JSON.stringify(details)],
	);
}

async function reconcileArchive(site: Site, photoId: string) {
	const token = await createArchiveToken({
		photoId,
		siteId: site.id,
		origin: site.origin,
		operation: "reconcile",
	});
	const response = await fetch(
		`${serverEnv().ARCHIVE_WORKER_URL}/v1/archive/${photoId}`,
		{ headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
	);
	if (!response.ok)
		return jsonError("Nie znaleziono oryginału w archiwum.", 404);
	const body = (await response.json()) as { receipt?: string };
	if (!body.receipt) return jsonError("Worker nie zwrócił potwierdzenia.", 502);
	const receipt = await verifyArchiveReceipt(body.receipt);
	await run(
		"update photos set archive_status = 'uploaded', archive_key = ?, last_error = null where id = ?",
		[receipt.archiveKey, photoId],
	);
	after(() => syncStorageUsage(site.id));
	return noStoreJson({ ok: true });
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const parsed = actionSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieznana akcja.", 400);
	const { photoId } = await params;
	const photo = await photoById(site.id, photoId);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);

	if (parsed.data.action === "approve" || parsed.data.action === "hide") {
		const status = parsed.data.action === "approve" ? "approved" : "rejected";
		try {
			await run(
				"update photos set moderation_status = ?, decided_at = ?, last_error = null where id = ?",
				[status, nowIso(), photoId],
			);
		} catch {
			return jsonError("Nie udało się zapisać decyzji.", 500);
		}
		await recordEvent(photoId, "admin", status);
		return noStoreJson({ ok: true });
	}

	if (parsed.data.action === "retry_moderation") {
		if (!moderationConfigured())
			return jsonError(
				"Ta instalacja nie ma skonfigurowanego Google Vision.",
				409,
			);
		const image = await derivativeBlob(
			derivativeKey(site.id, photo.storage_path),
		).catch(() => null);
		if (!image) return jsonError("Brak kopii galeryjnej.", 409);
		try {
			const result = await moderateImage(image);
			await run(
				"update photos set moderation_status = ?, moderation_scores = ?, last_error = null where id = ?",
				[result.status, JSON.stringify(result.scores), photoId],
			);
			await recordEvent(photoId, "vision", result.status, result.scores);
			return noStoreJson({ ok: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Błąd Vision.";
			await run(
				"update photos set moderation_status = 'review_required', last_error = ? where id = ?",
				[message, photoId],
			);
			return jsonError(message, 502);
		}
	}

	return reconcileArchive(site, photoId);
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const { photoId } = await params;
	const photo = await photoById(site.id, photoId);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	const errors: string[] = [];

	let storageError = false;
	try {
		await deleteDerivative(derivativeKey(site.id, photo.storage_path));
	} catch {
		storageError = true;
		errors.push("Nie usunięto kopii galeryjnej.");
	}

	let archiveStatus: ArchiveStatus = photo.archive_key
		? "deletion_error"
		: "failed";
	if (photo.archive_key) {
		const token = await createArchiveToken({
			photoId,
			siteId: site.id,
			origin: site.origin,
			operation: "delete",
			archiveKey: photo.archive_key,
		});
		const response = await fetch(
			`${serverEnv().ARCHIVE_WORKER_URL}/v1/archive/${photoId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
				cache: "no-store",
			},
		).catch(() => null);
		if (response?.ok) archiveStatus = "trashed";
		else errors.push("Nie usunięto oryginału z archiwum.");
	}

	await run(
		`update photos set hot_status = ?, blur_data_url = null, archive_status = ?,
		   moderation_status = 'rejected', last_error = ?, decided_at = ?
		 where id = ?`,
		[
			storageError ? "failed" : "deleted",
			archiveStatus,
			errors.join(" | ") || null,
			nowIso(),
			photoId,
		],
	);
	await recordEvent(
		photoId,
		"admin",
		errors.length ? "deletion_partial" : "deleted",
		errors.length ? { errors } : null,
	);
	after(() => syncStorageUsage(site.id));

	return noStoreJson({ ok: errors.length === 0, errors });
}
