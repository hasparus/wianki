import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";
import type { Site } from "@/lib/sites";

export const GUEST_COOKIE = "__Host-wianki_guest";
export const ADMIN_COOKIE = "__Host-wianki_admin";
export const OWNER_COOKIE = "__Host-wianki_owner";

const AUDIENCE = "wianki";
const encoder = new TextEncoder();

export type GuestSession = {
	role: "guest";
	guestId: string;
	siteId: string;
};

export type AdminSession = {
	role: "admin";
	siteId: string;
};

export type OwnerSession = {
	role: "owner";
	accountId: string;
};

type SiteKeyInput = Pick<Site, "id" | "session_key_version">;

/**
 * One platform secret, one derived key per purpose. A site's key folds in its
 * `session_key_version`, so bumping that column in D1 logs every guest and
 * admin of that site out without touching any other site or the secret.
 */
async function deriveKey(purpose: string) {
	const root = await crypto.subtle.importKey(
		"raw",
		encoder.encode(serverEnv().SESSION_SECRET),
		{ name: "HMAC", hash: "SHA-256" },
		false,
		["sign"],
	);
	return new Uint8Array(
		await crypto.subtle.sign("HMAC", root, encoder.encode(purpose)),
	);
}

function siteKey(site: SiteKeyInput) {
	return deriveKey(`site:${site.id}:${site.session_key_version}`);
}

function ownerKey() {
	return deriveKey("owner");
}

async function signSession(
	payload: JWTPayload,
	key: Uint8Array,
	expiresIn: string,
) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(AUDIENCE)
		.setExpirationTime(expiresIn)
		.sign(key);
}

async function verifySession(
	token: string | undefined,
	key: Uint8Array,
): Promise<JWTPayload | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, key, {
			algorithms: ["HS256"],
			audience: AUDIENCE,
		});
		return payload;
	} catch {
		return null;
	}
}

async function cookieValue(name: string) {
	return (await cookies()).get(name)?.value ?? undefined;
}

export async function createGuestSession(
	site: SiteKeyInput,
	guestId = crypto.randomUUID(),
) {
	return signSession(
		{ role: "guest", guestId, siteId: site.id },
		await siteKey(site),
		"7d",
	);
}

export async function createAdminSession(site: SiteKeyInput) {
	return signSession(
		{ role: "admin", siteId: site.id },
		await siteKey(site),
		"12h",
	);
}

export async function createOwnerSession(accountId: string) {
	return signSession({ role: "owner", accountId }, await ownerKey(), "30d");
}

export async function readGuestSession(
	site: SiteKeyInput,
	token?: string,
): Promise<GuestSession | null> {
	const payload = await verifySession(
		token ?? (await cookieValue(GUEST_COOKIE)),
		await siteKey(site),
	);
	if (
		payload?.role !== "guest" ||
		typeof payload.guestId !== "string" ||
		payload.siteId !== site.id
	)
		return null;
	return { role: "guest", guestId: payload.guestId, siteId: site.id };
}

export async function readAdminSession(
	site: SiteKeyInput,
	token?: string,
): Promise<AdminSession | null> {
	const payload = await verifySession(
		token ?? (await cookieValue(ADMIN_COOKIE)),
		await siteKey(site),
	);
	if (payload?.role !== "admin" || payload.siteId !== site.id) return null;
	return { role: "admin", siteId: site.id };
}

export async function readOwnerSession(
	token?: string,
): Promise<OwnerSession | null> {
	const payload = await verifySession(
		token ?? (await cookieValue(OWNER_COOKIE)),
		await ownerKey(),
	);
	if (payload?.role !== "owner" || typeof payload.accountId !== "string")
		return null;
	return { role: "owner", accountId: payload.accountId };
}

export async function requireGuest(site: SiteKeyInput) {
	const session = await readGuestSession(site);
	if (!session) redirect("/login");
	return session;
}

export async function requireAdmin(site: SiteKeyInput) {
	const session = await readAdminSession(site);
	if (!session) redirect("/");
	return session;
}

export async function requireOwner() {
	const session = await readOwnerSession();
	if (!session) redirect("/konto/login");
	return session;
}

/**
 * Guard for admin-only route handlers: returns the response to send back when
 * the request may not proceed, or null when it may.
 */
export async function denyAdminRequest(
	request: Request,
	site: SiteKeyInput & { origin: string },
): Promise<Response | null> {
	if (!(await readAdminSession(site)))
		return Response.json({ error: "Brak dostępu." }, { status: 401 });
	if (request.headers.get("origin") !== site.origin)
		return Response.json(
			{ error: "Nieprawidłowe źródło żądania." },
			{ status: 403 },
		);
	return null;
}

/** Same shape for the owner console: a cookie and a same-origin check. */
export async function denyOwnerRequest(
	request: Request,
	platformOrigin: string,
): Promise<{ response: Response } | { session: OwnerSession }> {
	const session = await readOwnerSession();
	if (!session)
		return {
			response: Response.json({ error: "Brak dostępu." }, { status: 401 }),
		};
	if (request.headers.get("origin") !== platformOrigin)
		return {
			response: Response.json(
				{ error: "Nieprawidłowe źródło żądania." },
				{ status: 403 },
			),
		};
	return { session };
}

export const guestCookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "lax" as const,
	path: "/",
	maxAge: 60 * 60 * 24 * 7,
};

export const adminCookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "strict" as const,
	path: "/",
	maxAge: 60 * 60 * 12,
};

export const ownerCookieOptions = {
	httpOnly: true,
	secure: true,
	sameSite: "lax" as const,
	path: "/",
	maxAge: 60 * 60 * 24 * 30,
};
