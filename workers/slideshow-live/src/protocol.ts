import { jwtVerify } from "jose";

/**
 * Wire vocabulary of the live slideshow. The Next.js app keeps its own copy
 * in `lib/slideshow-live.ts` — keep both in sync.
 */
export const SLIDESHOW_LIVE_AUDIENCE = "wedding-slideshow-live";
export const REACTION_EMOJI = ["❤️", "🥂", "😂", "👏", "🥹"] as const;
export const MAX_COMMENT_LENGTH = 140;
const MAX_RAW_MESSAGE_LENGTH = 4096;
const MAX_SLIDE_INDEX = 9999;
const MAX_SLIDE_ID_LENGTH = 64;

export type ReactionEmoji = (typeof REACTION_EMOJI)[number];
export type LiveRole = "guest" | "admin";

export type ControlMessage =
	| { type: "control"; action: "steer" }
	| {
			type: "control";
			action: "goto";
			index: number;
			slideId: string | null;
			playing: boolean;
	  };

export type ClientMessage =
	| { type: "reaction"; emoji: ReactionEmoji }
	| { type: "comment"; text: string }
	| ControlMessage;

/**
 * Authoritative presenter state of the room. `presenterId` is the connection
 * id of the steering admin — an opaque random id, carrying no personal data.
 */
export type ShowState = {
	presenterId: string | null;
	index: number;
	slideId: string | null;
	playing: boolean;
};

export const IDLE_SHOW_STATE: ShowState = {
	presenterId: null,
	index: 0,
	slideId: null,
	playing: false,
};

export type ServerMessage =
	| { type: "presence"; viewers: number }
	| { type: "reaction"; id: string; emoji: ReactionEmoji }
	| { type: "comment"; id: string; text: string }
	| { type: "throttled"; kind: "reaction" | "comment" | "control" }
	| {
			type: "show";
			live: boolean;
			index: number;
			slideId: string | null;
			playing: boolean;
			presenterId: string | null;
	  };

export function showMessage(state: ShowState): ServerMessage {
	return {
		type: "show",
		live: state.presenterId !== null,
		index: state.index,
		slideId: state.slideId,
		playing: state.playing,
		presenterId: state.presenterId,
	};
}

/**
 * Applies a control message to the show state. Returns the next state, or
 * null when the sender is not allowed to make that change (guests never
 * steer; `goto` is honored only from the current presenter).
 *
 * The presenter always steers: admin devices claim the show automatically,
 * and any admin's `steer` takes over (last wins — the couple shares the
 * admin QR). A presenter disconnect resets the room to idle.
 */
export function applyControl(
	state: ShowState,
	message: ControlMessage,
	connectionId: string,
	role: LiveRole,
): ShowState | null {
	if (role !== "admin") return null;
	if (message.action === "steer") {
		return { ...state, presenterId: connectionId };
	}
	if (state.presenterId !== connectionId) return null;
	return {
		presenterId: connectionId,
		index: message.index,
		slideId: message.slideId,
		playing: message.playing,
	};
}

export function isBrowserOriginAllowed(origin: string | null, allowed: string) {
	return origin === allowed;
}

export async function verifyLiveToken(
	token: string | null,
	secret: string,
): Promise<LiveRole | null> {
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

function parseControlMessage(
	message: Record<string, unknown>,
): ControlMessage | null {
	if (message.action === "steer") {
		return { type: "control", action: "steer" };
	}
	if (
		message.action === "goto" &&
		typeof message.index === "number" &&
		Number.isInteger(message.index) &&
		message.index >= 0 &&
		message.index <= MAX_SLIDE_INDEX &&
		(message.slideId === null ||
			(typeof message.slideId === "string" &&
				message.slideId.length <= MAX_SLIDE_ID_LENGTH)) &&
		typeof message.playing === "boolean"
	) {
		return {
			type: "control",
			action: "goto",
			index: message.index,
			slideId: (message.slideId as string | null) ?? null,
			playing: message.playing,
		};
	}
	return null;
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
	if (message.type === "control") {
		return parseControlMessage(message);
	}
	return null;
}

type RateLimit = { limit: number; windowMs: number };
type LimitedKind = "reaction" | "comment" | "control";
export type RateLimits = Record<LimitedKind, RateLimit>;

/** Generous enough for enthusiastic clapping, tight enough to stop floods. */
export const DEFAULT_RATE_LIMITS: RateLimits = {
	reaction: { limit: 20, windowMs: 10_000 },
	comment: { limit: 3, windowMs: 10_000 },
	control: { limit: 40, windowMs: 10_000 },
};

export class RateLimiter {
	private readonly limits: RateLimits;
	private readonly events: Record<LimitedKind, number[]> = {
		reaction: [],
		comment: [],
		control: [],
	};

	constructor(limits: RateLimits = DEFAULT_RATE_LIMITS) {
		this.limits = limits;
	}

	allow(kind: LimitedKind, now = Date.now()): boolean {
		const { limit, windowMs } = this.limits[kind];
		const fresh = this.events[kind].filter((at) => now - at < windowMs);
		this.events[kind] = fresh;
		if (fresh.length >= limit) return false;
		fresh.push(now);
		return true;
	}
}
