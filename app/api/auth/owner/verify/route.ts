import { NextResponse } from "next/server";
import { consumeLoginToken } from "@/lib/accounts";
import {
	createOwnerSession,
	OWNER_COOKIE,
	ownerCookieOptions,
} from "@/lib/auth/session";
import { platformOrigin } from "@/lib/env";

/**
 * The link from the e-mail lands here. A valid, unused, unexpired token
 * becomes an owner cookie and a redirect to the console; anything else goes
 * back to the login form with one reason, so the page cannot tell an expired
 * token from a forged one.
 */
export async function GET(request: Request) {
	const origin = platformOrigin();
	const token = new URL(request.url).searchParams.get("token");
	const account = await consumeLoginToken(token);
	if (!account) {
		return NextResponse.redirect(
			new URL("/konto/login?error=expired", origin),
			{ headers: { "Cache-Control": "no-store" } },
		);
	}
	const response = NextResponse.redirect(new URL("/konto", origin), {
		headers: { "Cache-Control": "no-store" },
	});
	response.cookies.set(
		OWNER_COOKIE,
		await createOwnerSession(account.id),
		ownerCookieOptions,
	);
	return response;
}
