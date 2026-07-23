import { readAdminSession } from "@/lib/auth/session";
import { getAdminQueue } from "@/lib/admin";
import { jsonError, noStoreJson } from "@/lib/http";

export async function GET() {
  if (!(await readAdminSession())) return jsonError("Brak dostępu.", 401);
  try {
    return noStoreJson({ photos: await getAdminQueue() });
  } catch {
    return jsonError("Nie udało się pobrać kolejki.", 500);
  }
}
