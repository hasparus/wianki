import { jwtVerify, SignJWT } from "jose";
import { serverEnv } from "@/lib/env";

const encoder = new TextEncoder();

/**
 * Shared vocabulary of the live layer. The worker keeps its own copy in
 * `workers/slideshow-live/src/protocol.ts` — keep both in sync.
 */
export const SLIDESHOW_LIVE_AUDIENCE = "wedding-slideshow-live";
export const SLIDESHOW_ROOM = "wesele";
export const SLIDESHOW_PARTY = "slideshow-party";
export const REACTION_EMOJI = ["❤️", "🥂", "😂", "👏", "🥹"] as const;
export const MAX_COMMENT_LENGTH = 140;

export type SlideshowLiveRole = "guest" | "admin";

export type SlideshowLiveAccess = {
	host: string;
	party: string;
	room: string;
	token: string;
};

export function slideshowLiveConfigured() {
	const env = serverEnv();
	return Boolean(env.SLIDESHOW_LIVE_URL && env.SLIDESHOW_LIVE_SECRET);
}

export async function createSlideshowLiveAccess(
	role: SlideshowLiveRole,
): Promise<SlideshowLiveAccess | null> {
	const env = serverEnv();
	if (!env.SLIDESHOW_LIVE_URL || !env.SLIDESHOW_LIVE_SECRET) return null;
	const token = await new SignJWT({ role })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(SLIDESHOW_LIVE_AUDIENCE)
		.setExpirationTime("12h")
		.sign(encoder.encode(env.SLIDESHOW_LIVE_SECRET));
	return {
		host: new URL(env.SLIDESHOW_LIVE_URL).host,
		party: SLIDESHOW_PARTY,
		room: SLIDESHOW_ROOM,
		token,
	};
}

export async function verifySlideshowLiveToken(
	token: string,
	secret: string,
): Promise<SlideshowLiveRole | null> {
	try {
		const { payload } = await jwtVerify(token, encoder.encode(secret), {
			algorithms: ["HS256"],
			audience: SLIDESHOW_LIVE_AUDIENCE,
		});
		return payload.role === "guest" || payload.role === "admin"
			? payload.role
			: null;
	} catch {
		return null;
	}
}
