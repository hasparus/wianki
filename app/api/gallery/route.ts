import { readAdminSession, readGuestSession } from "@/lib/auth/session";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";

export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	if (!(await readGuestSession(site)) && !(await readAdminSession(site)))
		return jsonError("Sesja gościa wygasła.", 401);
	const cursor = new URL(request.url).searchParams.get("cursor");
	try {
		const [page, stats] = await Promise.all([
			getGalleryPage(site.id, cursor),
			getGalleryStats(site.id),
		]);
		return noStoreJson({ ...page, stats });
	} catch {
		return jsonError("Nie udało się odświeżyć galerii.", 500);
	}
}
