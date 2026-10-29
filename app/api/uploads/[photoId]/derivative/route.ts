import { readGuestSession } from "@/lib/auth/session";
import { first } from "@/lib/db";
import { acceptedDerivativeTypes, MAX_DERIVATIVE_BYTES } from "@/lib/domain";
import { assertSameOrigin, jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import { derivativeKey, putDerivative } from "@/lib/storage";

/**
 * The browser puts the EXIF-free derivative here, raw bytes in the body.
 * At most 500 KiB, so it rides through the Worker without a presigned URL;
 * the original is the big one and still streams to the archive Worker.
 */
export async function PUT(
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
	const contentType = request.headers.get("content-type")?.split(";")[0].trim();
	if (
		!contentType ||
		!(acceptedDerivativeTypes as readonly string[]).includes(contentType)
	) {
		return jsonError("Nieobsługiwany typ kopii galeryjnej.", 415);
	}
	const declared = Number(request.headers.get("content-length"));
	if (Number.isFinite(declared) && declared > MAX_DERIVATIVE_BYTES) {
		return jsonError("Kopia galeryjna jest zbyt duża.", 413);
	}

	const { photoId } = await params;
	const photo = await first<{ storage_path: string; hot_status: string }>(
		"select storage_path, hot_status from photos where id = ? and site_id = ? and guest_id = ?",
		[photoId, site.id, session.guestId],
	);
	if (!photo) return jsonError("Nie znaleziono zdjęcia.", 404);
	if (photo.hot_status !== "pending" && photo.hot_status !== "failed") {
		return jsonError("To zdjęcie już ma kopię galeryjną.", 409);
	}

	const body = await request.arrayBuffer();
	if (body.byteLength === 0 || body.byteLength > MAX_DERIVATIVE_BYTES) {
		return jsonError("Kopia galeryjna ma nieprawidłowy rozmiar.", 413);
	}
	try {
		await putDerivative(
			derivativeKey(site.id, photo.storage_path),
			body,
			contentType,
		);
	} catch {
		return jsonError("Kopia galeryjna nie dotarła.", 502);
	}
	return noStoreJson({ ok: true, size: body.byteLength });
}
