import { z } from "zod";
import { createArchiveToken, verifyArchiveReceipt } from "@/lib/archive-token";
import { readAdminSession } from "@/lib/auth/session";
import { type ArchiveStatus, GALLERY_BUCKET } from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { moderateImage } from "@/lib/moderation";
import { supabaseAdmin } from "@/lib/supabase/server";

const actionSchema = z.object({
	action: z.enum(["approve", "hide", "retry_moderation", "reconcile_archive"]),
});

async function photoById(photoId: string) {
	const { data, error } = await supabaseAdmin()
		.from("photos")
		.select("id,storage_path,drive_file_id,original_size")
		.eq("id", photoId)
		.single();
	if (error || !data) return null;
	return data as {
		id: string;
		storage_path: string;
		drive_file_id: string | null;
		original_size: number;
	};
}

export async function PATCH(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	try {
		assertSameOrigin(request);
	} catch (response) {
		return response as Response;
	}
	const parsed = actionSchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Nieznana akcja.", 400);
	const { photoId } = await params;
	const photo = await photoById(photoId);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	const supabase = supabaseAdmin();

	if (parsed.data.action === "approve" || parsed.data.action === "hide") {
		const status = parsed.data.action === "approve" ? "approved" : "rejected";
		const { error } = await supabase
			.from("photos")
			.update({
				moderation_status: status,
				decided_at: new Date().toISOString(),
				last_error: null,
			})
			.eq("id", photoId);
		if (error) return jsonError("Nie udało się zapisać decyzji.", 500);
		await supabase.from("moderation_events").insert({
			photo_id: photoId,
			actor: "admin",
			action: status,
		});
		return noStoreJson({ ok: true });
	}

	if (parsed.data.action === "retry_moderation") {
		const { data: image, error: imageError } = await supabase.storage
			.from(GALLERY_BUCKET)
			.download(photo.storage_path);
		if (imageError || !image) return jsonError("Brak kopii galeryjnej.", 409);
		try {
			const result = await moderateImage(image);
			await supabase
				.from("photos")
				.update({
					moderation_status: result.status,
					moderation_scores: result.scores,
					last_error: null,
				})
				.eq("id", photoId);
			await supabase.from("moderation_events").insert({
				photo_id: photoId,
				actor: "vision",
				action: result.status,
				details: result.scores,
			});
			return noStoreJson({ ok: true });
		} catch (error) {
			const message = error instanceof Error ? error.message : "Błąd Vision.";
			await supabase
				.from("photos")
				.update({ moderation_status: "review_required", last_error: message })
				.eq("id", photoId);
			return jsonError(message, 502);
		}
	}

	const token = await createArchiveToken({
		photoId,
		operation: "reconcile",
	});
	const response = await fetch(
		`${serverEnv().ARCHIVE_WORKER_URL}/v1/archive/${photoId}`,
		{ headers: { Authorization: `Bearer ${token}` }, cache: "no-store" },
	);
	if (!response.ok) return jsonError("Nie znaleziono oryginału w Drive.", 404);
	const body = (await response.json()) as { receipt?: string };
	if (!body.receipt) return jsonError("Worker nie zwrócił potwierdzenia.", 502);
	const receipt = await verifyArchiveReceipt(body.receipt);
	await supabase
		.from("photos")
		.update({
			archive_status: "uploaded",
			drive_file_id: receipt.driveFileId,
			last_error: null,
		})
		.eq("id", photoId);
	return noStoreJson({ ok: true });
}

export async function DELETE(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	try {
		assertSameOrigin(request);
	} catch (response) {
		return response as Response;
	}
	const { photoId } = await params;
	const photo = await photoById(photoId);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	const supabase = supabaseAdmin();
	const errors: string[] = [];

	const { error: storageError } = await supabase.storage
		.from(GALLERY_BUCKET)
		.remove([photo.storage_path]);
	if (storageError) errors.push("Nie usunięto kopii galeryjnej.");

	let archiveStatus: ArchiveStatus = photo.drive_file_id
		? "deletion_error"
		: "failed";
	if (photo.drive_file_id) {
		const token = await createArchiveToken({
			photoId,
			operation: "delete",
			driveFileId: photo.drive_file_id,
		});
		const response = await fetch(
			`${serverEnv().ARCHIVE_WORKER_URL}/v1/archive/${photoId}`,
			{
				method: "DELETE",
				headers: { Authorization: `Bearer ${token}` },
				cache: "no-store",
			},
		);
		if (response.ok) archiveStatus = "trashed";
		else errors.push("Nie przeniesiono oryginału do kosza Drive.");
	}

	await supabase
		.from("photos")
		.update({
			hot_status: storageError ? "failed" : "deleted",
			archive_status: archiveStatus,
			moderation_status: "rejected",
			last_error: errors.join(" | ") || null,
			decided_at: new Date().toISOString(),
		})
		.eq("id", photoId);
	await supabase.from("moderation_events").insert({
		photo_id: photoId,
		actor: "admin",
		action: errors.length ? "deletion_partial" : "deleted",
		details: errors.length ? { errors } : null,
	});

	return noStoreJson({ ok: errors.length === 0, errors });
}
