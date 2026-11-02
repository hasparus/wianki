import { after } from "next/server";
import { z } from "zod";
import { verifyArchiveReceipt } from "@/lib/archive-token";
import { readGuestSession } from "@/lib/auth/session";
import { syncStorageUsage } from "@/lib/billing";
import { parseBlurDataUrl } from "@/lib/blur-placeholder";
import { first, run } from "@/lib/db";
import {
	type ArchiveStatus,
	acceptedDerivativeTypes,
	MAX_BLUR_DATA_URL_LENGTH,
	MAX_DERIVATIVE_BYTES,
	type ModerationStatus,
} from "@/lib/domain";
import { moderationConfigured } from "@/lib/env";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { moderateImage } from "@/lib/moderation";
import { siteFromRequest } from "@/lib/sites";
import { derivativeBlob, derivativeKey } from "@/lib/storage";

const bodySchema = z.object({
	archiveReceipt: z.string().min(1).nullable(),
	archiveError: z.string().max(500).nullable().optional(),
	derivativeSize: z.number().int().positive().max(MAX_DERIVATIVE_BYTES),
	derivativeType: z.enum(acceptedDerivativeTypes),
	width: z.number().int().positive().max(20_000),
	height: z.number().int().positive().max(20_000),
	blurDataUrl: z.preprocess(
		(value) =>
			typeof value === "string" && value.length > MAX_BLUR_DATA_URL_LENGTH
				? null
				: value,
		z.string().nullable().optional(),
	),
});

async function recordModerationEvent(
	photoId: string,
	actor: "vision" | "admin" | "system",
	action: string,
	details: unknown,
) {
	await run(
		"insert into moderation_events (photo_id, actor, action, details) values (?, ?, ?, ?)",
		[photoId, actor, action, details === null ? null : JSON.stringify(details)],
	);
}

async function moderateFinalizedPhoto(
	photoId: string,
	image: Blob,
	archiveError: string | null,
) {
	let moderationStatus: ModerationStatus = "review_required";
	let moderationScores: Record<string, string | undefined> | null = null;
	let moderationError: string | null = null;

	try {
		const moderation = await moderateImage(image);
		moderationStatus = moderation.status;
		moderationScores = moderation.scores;
	} catch (error) {
		moderationError =
			error instanceof Error
				? error.message
				: "Nie udało się sprawdzić zdjęcia.";
	}

	const lastError =
		[archiveError, moderationError].filter(Boolean).join(" | ") || null;
	await run(
		"update photos set moderation_status = ?, moderation_scores = ?, last_error = ? where id = ?",
		[
			moderationStatus,
			moderationScores ? JSON.stringify(moderationScores) : null,
			lastError,
			photoId,
		],
	);
	await recordModerationEvent(
		photoId,
		moderationScores ? "vision" : "system",
		moderationStatus,
		moderationScores ?? { error: moderationError },
	);
}

async function recordAutoApproval(photoId: string) {
	await recordModerationEvent(photoId, "system", "approved", {
		reason: "moderation_disabled",
	});
}

export async function POST(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const session = await readGuestSession(site);
	if (!session) return jsonError("Sesja gościa wygasła.", 401);
	try {
		assertSameOrigin(request, site.origin);
	} catch (response) {
		return response as Response;
	}

	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success)
		return jsonError("Nieprawidłowe potwierdzenie zdjęcia.", 400);
	const { photoId } = await params;
	const photo = await first<{
		id: string;
		storage_path: string;
		original_size: number;
		archive_status: string;
		archive_key: string | null;
	}>(
		"select id, storage_path, original_size, archive_status, archive_key from photos where id = ? and site_id = ? and guest_id = ?",
		[photoId, site.id, session.guestId],
	);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);

	let archiveKey: string | null = photo.archive_key;
	let archiveStatus: ArchiveStatus =
		photo.archive_status === "uploaded" ? "uploaded" : "failed";
	let archiveError = parsed.data.archiveError ?? null;
	if (parsed.data.archiveReceipt) {
		try {
			const receipt = await verifyArchiveReceipt(parsed.data.archiveReceipt);
			if (
				receipt.photoId !== photoId ||
				receipt.size !== Number(photo.original_size)
			) {
				throw new Error("Potwierdzenie dotyczy innego zdjęcia.");
			}
			archiveKey = receipt.archiveKey;
			archiveStatus = "uploaded";
			archiveError = null;
		} catch (error) {
			archiveError =
				error instanceof Error
					? error.message
					: "Błędne potwierdzenie archiwum.";
		}
	}

	const image = await derivativeBlob(
		derivativeKey(site.id, photo.storage_path),
	).catch(() => null);
	if (!image || image.size > MAX_DERIVATIVE_BYTES) {
		const galleryError = "Nieprawidłowa kopia galeryjna.";
		const lastError =
			[galleryError, archiveError].filter(Boolean).join(" | ") || galleryError;
		await run(
			"update photos set hot_status = 'failed', archive_status = ?, archive_key = ?, last_error = ? where id = ?",
			[archiveStatus, archiveKey, lastError, photoId],
		);
		return jsonError("Nie udało się zweryfikować kopii galeryjnej.", 400);
	}

	// A site asks for moderation, and the deployment has Vision to do it.
	// Asking without Vision would park every photo in review_required.
	const moderationEnabled = site.moderationEnabled && moderationConfigured();
	const moderationStatus: ModerationStatus = moderationEnabled
		? "pending"
		: "approved";
	try {
		await run(
			`update photos set hot_status = 'uploaded', archive_status = ?, moderation_status = ?,
			   archive_key = ?, derivative_size = ?, derivative_content_type = ?, width = ?, height = ?,
			   blur_data_url = ?, moderation_scores = null, last_error = ?
			 where id = ?`,
			[
				archiveStatus,
				moderationStatus,
				archiveKey,
				parsed.data.derivativeSize,
				parsed.data.derivativeType,
				parsed.data.width,
				parsed.data.height,
				parseBlurDataUrl(parsed.data.blurDataUrl),
				archiveError,
				photoId,
			],
		);
	} catch {
		return jsonError("Nie udało się zapisać wyniku zdjęcia.", 500);
	}

	after(async () => {
		await (moderationEnabled
			? moderateFinalizedPhoto(photoId, image, archiveError)
			: recordAutoApproval(photoId));
		await syncStorageUsage(site.id);
	});

	return noStoreJson({
		ok: true,
		archiveStatus,
		moderationStatus,
		warning: archiveError,
	});
}
