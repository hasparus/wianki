import { cookies } from "next/headers";
import { secretMatches } from "@/lib/auth/secrets";
import {
	ADMIN_COOKIE,
	adminCookieOptions,
	createAdminSession,
	createGuestSession,
	GUEST_COOKIE,
	guestCookieOptions,
} from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { assertSameOrigin, jsonError } from "@/lib/http";

/**
 * One passphrase field, two roles. The admin passphrase is checked first and
 * is never hinted at in the UI; a wrong guess is indistinguishable from a
 * wrong guest passphrase, so the form leaks nothing about which one exists.
 */
export async function POST(request: Request) {
	try {
		assertSameOrigin(request);
	} catch (response) {
		return response as Response;
	}

	const formData = await request.formData();
	const passphrase = formData.get("passphrase");
	if (typeof passphrase !== "string") {
		return jsonError("Nieprawidłowe hasło.", 401);
	}

	const env = serverEnv();
	const jar = await cookies();

	if (
		env.ADMIN_ACCESS_PASSPHRASE &&
		secretMatches(passphrase, env.ADMIN_ACCESS_PASSPHRASE)
	) {
		jar.set(ADMIN_COOKIE, await createAdminSession(), adminCookieOptions);
		return Response.json({ ok: true, redirect: "/admin" });
	}

	if (!secretMatches(passphrase, env.GUEST_ACCESS_PASSPHRASE)) {
		return jsonError("Nieprawidłowe hasło.", 401);
	}

	jar.set(GUEST_COOKIE, await createGuestSession(), guestCookieOptions);
	return Response.json({ ok: true, redirect: "/" });
}
