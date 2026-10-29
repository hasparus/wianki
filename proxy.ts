import type { NextRequest } from "next/server";
import { NextResponse } from "next/server";
import { ADMIN_COOKIE, GUEST_COOKIE, OWNER_COOKIE } from "@/lib/auth/session";
import { ServerEnvError, serverEnv } from "@/lib/env";
import { targetFromHost } from "@/lib/sites";

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

/**
 * The owner console lives on the platform host. Public: the landing page,
 * pricing, privacy, login, the Stripe webhook. Everything under /konto and
 * /api/konto wants an owner cookie; the handlers verify it properly.
 */
function platformProxy(request: NextRequest) {
	const { pathname } = request.nextUrl;
	const needsOwner =
		(pathname.startsWith("/konto") && !pathname.startsWith("/konto/login")) ||
		pathname.startsWith("/api/konto");
	if (needsOwner && !request.cookies.has(OWNER_COOKIE)) {
		if (pathname.startsWith("/api/")) {
			return NextResponse.json({ error: "Brak dostępu." }, { status: 401 });
		}
		const login = new URL("/konto/login", request.url);
		login.searchParams.set("next", pathname);
		return NextResponse.redirect(login);
	}
	// A wedding's pages do not exist on the platform host.
	if (
		pathname === "/login" ||
		pathname === "/admin" ||
		pathname.startsWith("/admin/") ||
		pathname === "/pokaz" ||
		pathname.startsWith("/api/uploads") ||
		pathname.startsWith("/api/gallery") ||
		pathname.startsWith("/api/admin") ||
		pathname.startsWith("/api/photos") ||
		pathname.startsWith("/api/slideshow")
	) {
		return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
	}
	return NextResponse.next();
}

function decodeSegment(segment: string) {
	try {
		return decodeURIComponent(segment);
	} catch {
		return null;
	}
}

/**
 * A wedding's host. Secrets live in D1, which the proxy does not read, so
 * every exchange of a token, join code or open house for a cookie is handed
 * to /api/auth/enter and only the presence of a cookie is checked here.
 */
function siteProxy(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;

	if (
		(pathname === "/" || pathname === "/admin") &&
		searchParams.has("token")
	) {
		const enter = new URL("/api/auth/enter", request.url);
		enter.searchParams.set("token", searchParams.get("token") ?? "");
		enter.searchParams.set("next", pathname);
		return NextResponse.redirect(enter);
	}

	// Short join link shown as a QR code during the slideshow. The code is a
	// separate, independently rotatable shared secret — leaking a photo of
	// the projected QR never burns the printed table QR codes.
	const joinMatch = pathname.match(/^\/p\/([^/]+)$/);
	if (joinMatch) {
		const code = decodeSegment(joinMatch[1]);
		if (!code) return NextResponse.redirect(new URL("/login", request.url));
		const enter = new URL("/api/auth/enter", request.url);
		enter.searchParams.set("code", code);
		enter.searchParams.set("next", "/pokaz");
		return NextResponse.redirect(enter);
	}

	const publicPath =
		pathname === "/login" ||
		pathname === "/privacy" ||
		pathname.startsWith("/api/auth/");
	if (publicPath) return NextResponse.next();

	// Owner console paths do not exist on a wedding's host.
	if (pathname.startsWith("/konto") || pathname.startsWith("/api/konto")) {
		return NextResponse.rewrite(new URL("/404", request.url), { status: 404 });
	}

	if (pathname.startsWith("/admin") || pathname.startsWith("/api/admin")) {
		if (!request.cookies.has(ADMIN_COOKIE)) {
			return NextResponse.redirect(new URL("/", request.url));
		}
		return NextResponse.next();
	}

	// Any signed-in device passes this optimistic gate; the couple's admin
	// session counts as one, so they reach /pokaz without scanning a guest QR.
	// Every page and handler still authorizes its own request. A first visit
	// goes through /api/auth/enter, which knows whether the open house is on.
	if (
		!request.cookies.has(GUEST_COOKIE) &&
		!request.cookies.has(ADMIN_COOKIE)
	) {
		if (pathname.startsWith("/api/")) {
			return NextResponse.json(
				{ error: "Sesja gościa wygasła." },
				{ status: 401 },
			);
		}
		const enter = new URL("/api/auth/enter", request.url);
		enter.searchParams.set("next", pathname);
		return NextResponse.redirect(enter);
	}
	return NextResponse.next();
}

export async function proxy(request: NextRequest) {
	let env: ReturnType<typeof serverEnv>;
	try {
		env = serverEnv();
	} catch (error) {
		if (error instanceof ServerEnvError) {
			return serverEnvErrorResponse(error, request.nextUrl.pathname);
		}
		throw error;
	}

	const target = targetFromHost(request.headers.get("host"), env.PLATFORM_HOST);
	return target.kind === "platform"
		? platformProxy(request)
		: siteProxy(request);
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp|woff2)$).*)",
	],
};
