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
import { serverEnv } from "@/lib/env";

export async function proxy(request: NextRequest) {
	const { pathname, searchParams } = request.nextUrl;
	const env = serverEnv();

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
		const candidate = decodeURIComponent(joinMatch[1]);
		if (env.GUEST_JOIN_CODE && secretMatches(candidate, env.GUEST_JOIN_CODE)) {
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

	if (!request.cookies.has(GUEST_COOKIE)) {
		const adminPreviewPath =
			pathname === "/pokaz" || pathname.startsWith("/api/slideshow");
		if (adminPreviewPath && request.cookies.has(ADMIN_COOKIE)) {
			return NextResponse.next();
		}
		return NextResponse.redirect(new URL("/login", request.url));
	}
	return NextResponse.next();
}

export const config = {
	matcher: [
		"/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|webp)$).*)",
	],
};
