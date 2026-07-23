import { cookies } from "next/headers";
import { GUEST_COOKIE, createGuestSession, guestCookieOptions } from "@/lib/auth/session";
import { secretMatches } from "@/lib/auth/secrets";
import { serverEnv } from "@/lib/env";
import { assertSameOrigin, jsonError } from "@/lib/http";

export async function POST(request: Request) {
  try {
    assertSameOrigin(request);
  } catch (response) {
    return response as Response;
  }

  const formData = await request.formData();
  const passphrase = formData.get("passphrase");
  if (
    typeof passphrase !== "string" ||
    !secretMatches(passphrase, serverEnv().GUEST_ACCESS_PASSPHRASE)
  ) {
    return jsonError("Nieprawidłowe hasło z zaproszenia.", 401);
  }

  (await cookies()).set(
    GUEST_COOKIE,
    await createGuestSession(),
    guestCookieOptions,
  );
  return Response.json({ ok: true });
}
