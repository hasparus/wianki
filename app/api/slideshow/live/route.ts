import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { createSlideshowLiveAccess } from "@/lib/slideshow-live";

export async function GET() {
	// Admin wins when both cookies are present — the couple has usually
	// scanned the guest QR too, and they must be able to steer the show.
	const admin = await readAdminSession();
	const guest = admin ? null : await readGuestSession();
	if (!guest && !admin) return jsonError("Sesja wygasła.", 401);
	try {
		const live = await createSlideshowLiveAccess(admin ? "admin" : "guest");
		return noStoreJson({ live });
	} catch {
		return jsonError("Nie udało się przygotować pokazu na żywo.", 500);
	}
}
