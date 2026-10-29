import { cookies } from "next/headers";
import { verifyPassphrase } from "@/lib/auth/secrets";
import {
	ADMIN_COOKIE,
	adminCookieOptions,
	createAdminSession,
	createGuestSession,
	GUEST_COOKIE,
	guestCookieOptions,
} from "@/lib/auth/session";
import { assertSameOrigin, jsonError } from "@/lib/http";
import { siteFromRequest } from "@/lib/sites";

/**
 * One passphrase field, two roles. The admin passphrase is checked first and
 * is never hinted at in the UI; a wrong guess is indistinguishable from a
 * wrong guest passphrase, so the form leaks nothing about which one exists.
 */
export async function POST(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return jsonError("Nie znaleziono strony.", 404);
	try {
		assertSameOrigin(request, site.origin);
	} catch (response) {
		return response as Response;
	}

	const formData = await request.formData();
	const passphrase = formData.get("passphrase");
	if (typeof passphrase !== "string") {
		return jsonError("Nieprawidłowe hasło.", 401);
	}

	const jar = await cookies();

	if (await verifyPassphrase(passphrase, site.admin_passphrase_hash)) {
		jar.set(ADMIN_COOKIE, await createAdminSession(site), adminCookieOptions);
		return Response.json({ ok: true, redirect: "/admin" });
	}

	if (!(await verifyPassphrase(passphrase, site.guest_passphrase_hash))) {
		return jsonError("Nieprawidłowe hasło.", 401);
	}

	jar.set(GUEST_COOKIE, await createGuestSession(site), guestCookieOptions);
	return Response.json({ ok: true, redirect: "/" });
}
