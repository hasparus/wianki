import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";
import { createSlideshowLiveAccess } from "@/lib/slideshow-live";

export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	// Admin wins when both cookies are present — the couple has usually
	// scanned the guest QR too, and they must be able to steer the show.
	const admin = await readAdminSession(site);
	const guest = admin ? null : await readGuestSession(site);
	if (!guest && !admin) return jsonError("Sesja wygasła.", 401);
	try {
		const live = await createSlideshowLiveAccess(
			site,
			admin ? "admin" : "guest",
		);
		return noStoreJson({ live });
	} catch {
		return jsonError("Nie udało się przygotować pokazu na żywo.", 500);
	}
}
