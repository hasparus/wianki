import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { createSlideshowLiveAccess } from "@/lib/slideshow-live";

export async function GET() {
	const guest = await readGuestSession();
	const admin = guest ? null : await readAdminSession();
	if (!guest && !admin) return jsonError("Sesja wygasła.", 401);
	try {
		const live = await createSlideshowLiveAccess(guest ? "guest" : "admin");
		return noStoreJson({ live });
	} catch {
		return jsonError("Nie udało się przygotować pokazu na żywo.", 500);
	}
}
