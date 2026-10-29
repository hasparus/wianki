import { denyAdminRequest } from "@/lib/auth/session";
import { getGalleryPage } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";

/** Approved gallery photos for the slide editor's picker. */
export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	const denied = await denyAdminRequest(request, site);
	if (denied) return denied;
	const cursor = new URL(request.url).searchParams.get("cursor");
	try {
		return noStoreJson(await getGalleryPage(site.id, cursor));
	} catch {
		return jsonError("Nie udało się pobrać zdjęć.", 500);
	}
}
