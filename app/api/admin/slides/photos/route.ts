import { readAdminSession } from "@/lib/auth/session";
import { getGalleryPage } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";
import { supabaseAdmin } from "@/lib/supabase/server";

/** Approved gallery photos for the slide editor's picker. */
export async function GET(request: Request) {
	if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
	const cursor = new URL(request.url).searchParams.get("cursor");
	try {
		const [page, used] = await Promise.all([
			getGalleryPage(cursor),
			supabaseAdmin()
				.from("slideshow_slides")
				.select("photo_id")
				.not("photo_id", "is", null),
		]);
		if (used.error) throw used.error;
		return noStoreJson({
			...page,
			usedPhotoIds: (used.data ?? []).map((row) => row.photo_id),
		});
	} catch {
		return jsonError("Nie udało się pobrać zdjęć.", 500);
	}
}
