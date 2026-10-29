import { NextResponse } from "next/server";
import { OWNER_COOKIE, ownerCookieOptions } from "@/lib/auth/session";
import { platformOrigin } from "@/lib/env";
import { assertSameOrigin } from "@/lib/http";

/** Clears the owner cookie. A plain form POST, so it works without scripts. */
export async function POST(request: Request) {
	const origin = platformOrigin();
	try {
		assertSameOrigin(request, origin);
	} catch (response) {
		return response as Response;
	}
	const response = NextResponse.redirect(new URL("/", origin), {
		status: 303,
		headers: { "Cache-Control": "no-store" },
	});
	response.cookies.set(OWNER_COOKIE, "", { ...ownerCookieOptions, maxAge: 0 });
	return response;
}
