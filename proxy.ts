import type { NextRequest } from "next/server";
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
import { ServerEnvError, serverEnv } from "@/lib/env";

function escapeHtml(value: string) {
	return value.replace(
		/[&<>"']/g,
		(character) =>
			({
				"&": "&amp;",
				"<": "&lt;",
				">": "&gt;",
				'"': "&quot;",
				"'": "&#39;",
			})[character] as string,
	);
}

function serverEnvErrorResponse(error: ServerEnvError, pathname: string) {
	if (pathname.startsWith("/api/")) {
		return NextResponse.json(
			{
				error: "Środowisko serwera jest źle skonfigurowane.",
				issues: error.issues,
			},
			{ status: 500, headers: { "Cache-Control": "no-store" } },
		);
	}

	const issues = error.issues
		.map(
			({ key, reason }) =>
				`<li><code>${escapeHtml(key)}</code><span>${escapeHtml(reason)}</span></li>`,
		)
		.join("");
	return new NextResponse(
		`<!doctype html>
<html lang="pl">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex, nofollow">
<title>Nie udało się uruchomić strony</title>
<style>
:root { color-scheme: light; font-family: ui-sans-serif, system-ui, sans-serif; }
* { box-sizing: border-box; }
body { min-height: 100vh; margin: 0; display: grid; place-items: center; background: Canvas; color: CanvasText; }
main { width: min(52rem, 100%); padding: clamp(2rem, 8vw, 6rem) clamp(1.25rem, 6vw, 4rem); }
small { display: block; margin-bottom: 1rem; font-size: .7rem; letter-spacing: .18em; text-transform: uppercase; }
h1 { max-width: 14ch; margin: 0; font-family: Georgia, serif; font-size: clamp(2.5rem, 8vw, 5rem); font-weight: 400; line-height: .95; }
p { max-width: 42rem; margin: 2rem 0; font-size: 1.05rem; line-height: 1.65; }
ul { margin: 0; padding: 0; border-top: 1px solid GrayText; list-style: none; }
li { display: grid; grid-template-columns: minmax(18rem, 1fr) 2fr; gap: 1rem; padding: .85rem 0; border-bottom: 1px solid GrayText; }
code { overflow-wrap: anywhere; font-weight: 700; }
span { overflow-wrap: anywhere; }
@media (max-width: 36rem) { li { grid-template-columns: 1fr; gap: .2rem; } }
</style>
</head>
<body>
<main>
<small>Błąd konfiguracji</small>
<h1>Nie udało się uruchomić strony.</h1>
<p>Serwer nie ma wszystkich wymaganych ustawień. Administrator powinien uzupełnić poniższe zmienne w środowisku tego wdrożenia.</p>
<ul>${issues}</ul>
</main>
</body>
</html>`,
		{
			status: 500,
			headers: {
				"Cache-Control": "no-store",
				"Content-Type": "text/html; charset=utf-8",
			},
		},
	);
}

function decodeJoinCode(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
}

export async function proxy(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;
	let env: ReturnType<typeof serverEnv>;
	try {
		env = serverEnv();
	} catch (error) {
		if (error instanceof ServerEnvError) {
			return serverEnvErrorResponse(error, pathname);
		}
		throw error;
	}

	if (pathname === "/" && searchParams.has("token")) {
		const candidate = searchParams.get("token") ?? "";
		const cleanUrl = request.nextUrl.clone();
		cleanUrl.searchParams.delete("token");
		const response = NextResponse.redirect(cleanUrl);
		if (secretMatches(candidate, env.GUEST_ENTRY_TOKEN)) {
			response.cookies.set(
				GUEST_COOKIE,
				await createGuestSession(),
				guestCookieOptions,
			);
		}
		return response;
	}

	// Short join link shown as a QR code during the slideshow. The code is a
	// separate, independently rotatable shared secret — leaking a photo of
	// the projected QR never burns the printed table QR codes.
	const joinMatch = pathname.match(/^\/p\/([^/]+)$/);
	if (joinMatch) {
		const candidate = decodeJoinCode(joinMatch[1]);
		if (
			candidate &&
			env.GUEST_JOIN_CODE &&
			secretMatches(candidate, env.GUEST_JOIN_CODE)
		) {
			const response = NextResponse.redirect(new URL("/pokaz", request.url));
			response.cookies.set(
				GUEST_COOKIE,
				await createGuestSession(),
				guestCookieOptions,
			);
			return response;
		}
		return NextResponse.redirect(new URL("/login", request.url));
	}

	if (pathname === "/admin" && searchParams.has("token")) {
		const candidate = searchParams.get("token") ?? "";
		const cleanUrl = request.nextUrl.clone();
		cleanUrl.searchParams.delete("token");
		const response = NextResponse.redirect(cleanUrl);
		if (secretMatches(candidate, env.ADMIN_ENTRY_TOKEN)) {
			response.cookies.set(
				ADMIN_COOKIE,
				await createAdminSession(),
				adminCookieOptions,
			);
		}
		return response;
	}

	// Open house: while GUEST_OPEN_UNTIL is in the future, a first visit mints
	// its own guest session, so nobody has to type the passphrase.
	if (
		env.GUEST_OPEN_UNTIL &&
		Date.now() < env.GUEST_OPEN_UNTIL.getTime() &&
		!request.cookies.has(GUEST_COOKIE)
	) {
		const session = await createGuestSession();
		request.cookies.set(GUEST_COOKIE, session);
		const response =
			pathname === "/login"
				? NextResponse.redirect(new URL("/", request.url))
				: NextResponse.next({ request: { headers: request.headers } });
		response.cookies.set(GUEST_COOKIE, session, guestCookieOptions);
		return response;
	}

	const publicPath =
		pathname === "/login" ||
		pathname === "/privacy" ||
		pathname.startsWith("/api/auth/");
	if (publicPath) return NextResponse.next();

	if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
		if (!request.cookies.has(ADMIN_COOKIE)) {
			return NextResponse.redirect(new URL("/", request.url));
		}
		return NextResponse.next();
	}

	// Any signed-in device passes this optimistic gate; the couple's admin
	// session counts as one, so they reach /pokaz without scanning a guest QR.
	// Every page and handler still authorizes its own request.
	if (
		!request.cookies.has(GUEST_COOKIE) &&
		!request.cookies.has(ADMIN_COOKIE)
	) {
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
	],
};
