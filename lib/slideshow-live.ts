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
	role: SlideshowLiveRole;
};

/** Presenter state broadcast by the worker as `{type:"show", ...}`. */
export type ShowStatePayload = {
	live: boolean;
	index: number;
	slideId: string | null;
	playing: boolean;
	presenterId: string | null;
	slideSeconds: number | null;
};

export const IDLE_SHOW: ShowStatePayload = {
	live: false,
	index: 0,
	slideId: null,
	playing: false,
	presenterId: null,
	slideSeconds: null,
};

/**
 * Maps the presenter's show state onto a locally loaded deck. Decks can
 * drift between viewers (a photo hidden after one of them loaded the page),
 * so slides are matched by id first and the raw index is only a clamped
 * fallback.
 */
export function resolveShowIndex(
	show: ShowStatePayload,
	slideIds: string[],
): number | null {
	if (slideIds.length === 0) return null;
	if (show.slideId) {
		const byId = slideIds.indexOf(show.slideId);
		if (byId !== -1) return byId;
	}
	return Math.min(Math.max(show.index, 0), slideIds.length - 1);
}

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
		role,
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
