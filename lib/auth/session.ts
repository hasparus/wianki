import { type JWTPayload, jwtVerify, SignJWT } from "jose";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { serverEnv } from "@/lib/env";

export const GUEST_COOKIE = "__Host-wedding_guest";
export const ADMIN_COOKIE = "__Host-wedding_admin";

const encoder = new TextEncoder();

export type GuestSession = {
	role: "guest";
	guestId: string;
};

export type AdminSession = {
	role: "admin";
};

function secret(value: string) {
	return encoder.encode(value);
}

async function signSession(
	payload: JWTPayload,
	sessionSecret: string,
	expiresIn: string,
) {
	return new SignJWT(payload)
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience("wedding-gallery")
		.setExpirationTime(expiresIn)
		.sign(secret(sessionSecret));
}

async function verifySession(
	token: string | undefined,
	sessionSecret: string,
): Promise<JWTPayload | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(token, secret(sessionSecret), {
			algorithms: ["HS256"],
			audience: "wedding-gallery",
		});
		return payload;
	} catch {
		return null;
	}
}

export function createGuestSession(guestId = crypto.randomUUID()) {
	return signSession(
		{ role: "guest", guestId },
		serverEnv().GUEST_SESSION_SECRET,
		"7d",
	);
}

export function createAdminSession() {
	return signSession(
		{ role: "admin" },
		serverEnv().ADMIN_SESSION_SECRET,
		"12h",
	);
}

export async function readGuestSession(
	token?: string,
): Promise<GuestSession | null> {
	const cookieToken =
		token ?? (await cookies()).get(GUEST_COOKIE)?.value ?? undefined;
	const payload = await verifySession(
		cookieToken,
		serverEnv().GUEST_SESSION_SECRET,
	);
	if (payload?.role !== "guest" || typeof payload.guestId !== "string")
		return null;
	return { role: "guest", guestId: payload.guestId };
}

export async function readAdminSession(
	token?: string,
): Promise<AdminSession | null> {
	const cookieToken =
		token ?? (await cookies()).get(ADMIN_COOKIE)?.value ?? undefined;
	const payload = await verifySession(
		token ?? cookieToken,
		serverEnv().ADMIN_SESSION_SECRET,
	);
	if (payload?.role !== "admin") return null;
	return { role: "admin" };
}

export async function requireGuest() {
	const session = await readGuestSession();
	if (!session) redirect("/login");
	return session;
}

export async function requireAdmin() {
	const session = await readAdminSession();
	if (!session) redirect("/");
	return session;
}

/**
 * Guard for admin-only route handlers: returns the response to send back when
 * the request may not proceed, or null when it may.
 */
export async function denyAdminRequest(
	request: Request,
): Promise<Response | null> {
	if (!(await readAdminSession()))
		return Response.json({ error: "Brak dostępu." }, { status: 401 });
	if (request.headers.get("origin") !== serverEnv().APP_ORIGIN)
		return Response.json(
			{ error: "Nieprawidłowe źródło żądania." },
			{ status: 403 },
		);
	return null;
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
