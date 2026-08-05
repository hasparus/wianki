import { jwtVerify } from "jose";

/**
 * Wire vocabulary of the live slideshow. The Next.js app keeps its own copy
 * in `lib/slideshow-live.ts` — keep both in sync.
 */
export const SLIDESHOW_LIVE_AUDIENCE = "wedding-slideshow-live";
export const REACTION_EMOJI = ["❤️", "🥂", "😂", "👏", "🥹"] as const;
export const MAX_COMMENT_LENGTH = 140;
const MAX_RAW_MESSAGE_LENGTH = 4096;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];

export type ClientMessage =
	| { type: "reaction"; emoji: ReactionEmoji }
	| { type: "comment"; text: string };

export type ServerMessage =
	| { type: "presence"; viewers: number }
	| { type: "reaction"; id: string; emoji: ReactionEmoji }
	| { type: "comment"; id: string; text: string }
	| { type: "throttled"; kind: ClientMessage["type"] };

export function isBrowserOriginAllowed(origin: string | null, allowed: string) {
	return origin === allowed;
}

export async function verifyLiveToken(
	token: string | null,
	secret: string,
): Promise<"guest" | "admin" | null> {
	if (!token) return null;
	try {
		const { payload } = await jwtVerify(
			token,
			new TextEncoder().encode(secret),
			{ algorithms: ["HS256"], audience: SLIDESHOW_LIVE_AUDIENCE },
		);
		return payload.role === "guest" || payload.role === "admin"
			? payload.role
			: null;
	} catch {
		return null;
	}
}

export function sanitizeComment(value: string): string | null {
	const collapsed = value
		// biome-ignore lint/suspicious/noControlCharactersInRegex: control characters are exactly what gets stripped here.
		.replace(/[\u0000-\u001f\u007f\u2028\u2029]/g, " ")
		.replace(/\s+/g, " ")
		.trim()
		.slice(0, MAX_COMMENT_LENGTH)
		.trim();
	return collapsed || null;
}

export function parseClientMessage(raw: unknown): ClientMessage | null {
	if (typeof raw !== "string" || raw.length > MAX_RAW_MESSAGE_LENGTH)
		return null;
	let value: unknown;
	try {
		value = JSON.parse(raw);
	} catch {
		return null;
	}
	if (typeof value !== "object" || value === null) return null;
	const message = value as Record<string, unknown>;
	if (
		message.type === "reaction" &&
		REACTION_EMOJI.includes(message.emoji as ReactionEmoji)
	) {
		return { type: "reaction", emoji: message.emoji as ReactionEmoji };
	}
	if (message.type === "comment" && typeof message.text === "string") {
		const text = sanitizeComment(message.text);
		return text ? { type: "comment", text } : null;
	}
	return null;
}

type RateLimit = { limit: number; windowMs: number };
export type RateLimits = Record<ClientMessage["type"], RateLimit>;

/** Generous enough for enthusiastic clapping, tight enough to stop floods. */
export const DEFAULT_RATE_LIMITS: RateLimits = {
	reaction: { limit: 20, windowMs: 10_000 },
	comment: { limit: 3, windowMs: 10_000 },
};

export class RateLimiter {
	private readonly limits: RateLimits;
	private readonly events: Record<ClientMessage["type"], number[]> = {
		reaction: [],
		comment: [],
	};

	constructor(limits: RateLimits = DEFAULT_RATE_LIMITS) {
		this.limits = limits;
	}

	allow(kind: ClientMessage["type"], now = Date.now()): boolean {
		const { limit, windowMs } = this.limits[kind];
		const fresh = this.events[kind].filter((at) => now - at < windowMs);
		this.events[kind] = fresh;
		if (fresh.length >= limit) return false;
		fresh.push(now);
		return true;
	}
}
