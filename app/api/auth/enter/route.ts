import { NextResponse } from "next/server";
import { secretMatches } from "@/lib/auth/secrets";
import {
	ADMIN_COOKIE,
	adminCookieOptions,
	createAdminSession,
	createGuestSession,
	GUEST_COOKIE,
	guestCookieOptions,
} from "@/lib/auth/session";
import { openHouseActive, siteFromRequest } from "@/lib/sites";

/** Only same-site paths may be a redirect target; anything else goes home. */
function safeNext(value: string | null, fallback = "/") {
	if (!value?.startsWith("/") || value.startsWith("//")) return fallback;
	return value;
}

/**
 * The one place a site hands out cookies without a passphrase. Entry QR
 * tokens, the slideshow join code and the open house all land here, because
 * the proxy cannot read D1 and the page tree cannot set cookies.
 */
export async function GET(request: Request) {
	const site = await siteFromRequest(request);
	if (!site) return new Response("Nie znaleziono strony.", { status: 404 });
	const url = new URL(request.url);
	const next = safeNext(url.searchParams.get("next"));
	const token = url.searchParams.get("token");
	const code = url.searchParams.get("code");

	if (token !== null) {
		const clean = new URL(next, url);
		const response = NextResponse.redirect(clean);
		if (next === "/admin") {
			if (secretMatches(token, site.admin_entry_token)) {
				response.cookies.set(
					ADMIN_COOKIE,
					await createAdminSession(site),
					adminCookieOptions,
				);
			}
			return response;
		}
		if (secretMatches(token, site.guest_entry_token)) {
			response.cookies.set(
				GUEST_COOKIE,
				await createGuestSession(site),
				guestCookieOptions,
			);
		}
		return response;
	}

	if (code !== null) {
		if (site.guest_join_code && secretMatches(code, site.guest_join_code)) {
			const response = NextResponse.redirect(new URL("/pokaz", url));
			response.cookies.set(
				GUEST_COOKIE,
				await createGuestSession(site),
				guestCookieOptions,
			);
			return response;
		}
		return NextResponse.redirect(new URL("/login", url));
	}

	// Open house: while guest_open_until is in the future, a first visit mints
	// its own guest session, so nobody has to type the passphrase.
	if (openHouseActive(site)) {
		const response = NextResponse.redirect(
			new URL(next === "/login" ? "/" : next, url),
		);
		response.cookies.set(
			GUEST_COOKIE,
			await createGuestSession(site),
			guestCookieOptions,
		);
		return response;
	}
	return NextResponse.redirect(new URL("/login", url));
}
