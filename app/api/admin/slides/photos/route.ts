import { denyAdminRequest } from "@/lib/auth/session";
import { getGalleryPage } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";

/** Approved gallery photos for the slide editor's picker. */
export async function GET(request: Request) {
	const denied = await denyAdminRequest(request);
	if (denied) return denied;
	const cursor = new URL(request.url).searchParams.get("cursor");
	try {
		return noStoreJson(await getGalleryPage(cursor));
	} catch {
		return jsonError("Nie udało się pobrać zdjęć.", 500);
	}
}
