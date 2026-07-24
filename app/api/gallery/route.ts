import { readGuestSession } from "@/lib/auth/session";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";
import { jsonError, noStoreJson } from "@/lib/http";

export async function GET(request: Request) {
  if (!(await readGuestSession())) return jsonError("Sesja gościa wygasła.", 401);
  const cursor = new URL(request.url).searchParams.get("cursor");
  try {
    const [page, stats] = await Promise.all([
      getGalleryPage(cursor),
      getGalleryStats(),
    ]);
    return noStoreJson({ ...page, stats });
  } catch {
    return jsonError("Nie udało się odświeżyć galerii.", 500);
  }
}
