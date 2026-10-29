import { decodeAdminCursor, getAdminPhotosPage } from "@/lib/admin";
import { readAdminSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";

export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	if (!(await readAdminSession(site))) return jsonError("Brak dostępu.", 401);
	const cursor = new URL(request.url).searchParams.get("cursor");
	if (cursor && !decodeAdminCursor(cursor)) {
		return jsonError("Nieprawidłowy kursor panelu.", 400);
	}
	try {
		return noStoreJson(await getAdminPhotosPage(site.id, cursor));
	} catch {
		return jsonError("Nie udało się pobrać zdjęć.", 500);
	}
}
