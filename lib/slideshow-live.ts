import { SignJWT } from "jose";
import { serverEnv } from "@/lib/env";
import type { Site } from "@/lib/sites";
import {
	SLIDESHOW_LIVE_AUDIENCE,
	SLIDESHOW_PARTY,
	type SlideshowLiveRole,
} from "@/lib/slideshow-protocol";

export type SlideshowLiveAccess = {
	host: string;
	party: string;
	room: string;
	token: string;
	role: SlideshowLiveRole;
};

export function slideshowLiveConfigured() {
	const env = serverEnv();
	return Boolean(env.SLIDESHOW_LIVE_URL && env.SLIDESHOW_LIVE_SECRET);
}

/**
 * One room per wedding, named by the site id. The token carries the room and
 * the site's origin, so the live Worker admits exactly this site's guests
 * and answers CORS for exactly this site's pages.
 */
export async function createSlideshowLiveAccess(
	site: Pick<Site, "id" | "origin">,
	role: SlideshowLiveRole,
): Promise<SlideshowLiveAccess | null> {
	const env = serverEnv();
	if (!env.SLIDESHOW_LIVE_URL || !env.SLIDESHOW_LIVE_SECRET) return null;
	const room = site.id;
	const token = await new SignJWT({ role, room, origin: site.origin })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(SLIDESHOW_LIVE_AUDIENCE)
		.setExpirationTime("12h")
		.sign(new TextEncoder().encode(env.SLIDESHOW_LIVE_SECRET));
	return {
		host: new URL(env.SLIDESHOW_LIVE_URL).host,
		party: SLIDESHOW_PARTY,
		room,
		token,
		role,
	};
}
