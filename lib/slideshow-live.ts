import { SignJWT } from "jose";
import { serverEnv } from "@/lib/env";
import {
	SLIDESHOW_LIVE_AUDIENCE,
	SLIDESHOW_PARTY,
	SLIDESHOW_ROOM,
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
		.sign(new TextEncoder().encode(env.SLIDESHOW_LIVE_SECRET));
	return {
		host: new URL(env.SLIDESHOW_LIVE_URL).host,
		party: SLIDESHOW_PARTY,
		room: SLIDESHOW_ROOM,
		token,
		role,
	};
}
