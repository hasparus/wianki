import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { first } from "@/lib/db";
import { jsonError } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import { derivativeKey, getDerivative } from "@/lib/storage";

/**
 * Streams a derivative out of the private bucket. Guests see what the
 * gallery rule allows; an admin also sees hidden and pending photos, because
 * the moderation queue has to show what it is deciding on. Nothing here is
 * ever cached by a shared cache.
 */
export async function GET(
	request: Request,
	{ params }: { params: Promise<{ photoId: string }> },
) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const admin = await readAdminSession(site);
	const guest = admin ? null : await readGuestSession(site);
	if (!admin && !guest) return jsonError("Sesja gościa wygasła.", 401);

	const { photoId } = await params;
	const photo = await first<{
		storage_path: string;
		hot_status: string;
		moderation_status: string;
		derivative_content_type: string | null;
	}>(
		"select storage_path, hot_status, moderation_status, derivative_content_type from photos where id = ? and site_id = ?",
		[photoId, site.id],
	);
	if (photo?.hot_status !== "uploaded")
		return jsonError("Nie znaleziono zdjęcia.", 404);
	if (!admin && photo.moderation_status !== "approved")
		return jsonError("Nie znaleziono zdjęcia.", 404);

	const object = await getDerivative(
		derivativeKey(site.id, photo.storage_path),
	);
	if (!object) return jsonError("Brak kopii galeryjnej.", 404);
	const etag = object.httpEtag;
	if (etag && request.headers.get("if-none-match") === etag) {
		return new Response(null, { status: 304, headers: { ETag: etag } });
	}
	const headers = new Headers({
		"Content-Type":
			object.httpMetadata?.contentType ??
			photo.derivative_content_type ??
			"image/jpeg",
		"Content-Length": String(object.size),
		"Cache-Control": "private, max-age=3600",
		"X-Content-Type-Options": "nosniff",
	});
	if (etag) headers.set("ETag", etag);
	return new Response(object.body as unknown as ReadableStream, { headers });
}
