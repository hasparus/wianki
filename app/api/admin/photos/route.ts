import { decodeAdminCursor, getAdminPhotosPage } from "@/lib/admin";
import { readAdminSession } from "@/lib/auth/session";
import { jsonError, noStoreJson } from "@/lib/http";

export async function GET(request: Request) {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	const cursor = new URL(request.url).searchParams.get("cursor");
	if (cursor && !decodeAdminCursor(cursor)) {
		return jsonError("Nieprawidłowy kursor panelu.", 400);
	}
	try {
		return noStoreJson(await getAdminPhotosPage(cursor));
	} catch {
		return jsonError("Nie udało się pobrać zdjęć.", 500);
	}
}
