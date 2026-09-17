import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import {
	applyControl,
	IDLE_SHOW_STATE,
	MAX_COMMENT_LENGTH,
	parseClientMessage,
	RateLimiter,
	SLIDESHOW_LIVE_AUDIENCE,
	sanitizeComment,
	verifyLiveToken,
} from "../../../lib/slideshow-protocol";

const secret = "0123456789abcdef0123456789abcdef";

async function token(role: string, audience = SLIDESHOW_LIVE_AUDIENCE) {
	return new SignJWT({ role })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(audience)
		.setExpirationTime("1h")
		.sign(new TextEncoder().encode(secret));
}

describe("live token verification", () => {
	it("accepts guest and admin roles", async () => {
		expect(await verifyLiveToken(await token("guest"), secret)).toBe("guest");
		expect(await verifyLiveToken(await token("admin"), secret)).toBe("admin");
	});

	it("rejects missing tokens, foreign audiences, and unknown roles", async () => {
		expect(await verifyLiveToken(null, secret)).toBeNull();
		expect(
			await verifyLiveToken(await token("guest", "other-audience"), secret),
		).toBeNull();
		expect(await verifyLiveToken(await token("root"), secret)).toBeNull();
	});
});

describe("client message parsing", () => {
	it("accepts allow-listed reactions only", () => {
		expect(
			parseClientMessage(JSON.stringify({ type: "reaction", emoji: "❤️" })),
		).toEqual({ type: "reaction", emoji: "❤️" });
		expect(
			parseClientMessage(JSON.stringify({ type: "reaction", emoji: "🔥" })),
		).toBeNull();
	});

	it("sanitizes comments and rejects empty ones", () => {
		expect(
			parseClientMessage(
				JSON.stringify({ type: "comment", text: "  Sto\u0000lat!\n\n" }),
			),
		).toEqual({ type: "comment", text: "Sto lat!" });
		expect(
			parseClientMessage(JSON.stringify({ type: "comment", text: " \n\t " })),
		).toBeNull();
	});

	it("caps comment length", () => {
		const long = "a".repeat(500);
		const parsed = parseClientMessage(
			JSON.stringify({ type: "comment", text: long }),
		);
		expect(parsed?.type).toBe("comment");
		if (parsed?.type === "comment") {
			expect(parsed.text).toHaveLength(MAX_COMMENT_LENGTH);
		}
	});

	it("rejects malformed payloads and binary frames", () => {
		expect(parseClientMessage("not json")).toBeNull();
		expect(parseClientMessage(JSON.stringify({ type: "unknown" }))).toBeNull();
		expect(parseClientMessage(new ArrayBuffer(4))).toBeNull();
		expect(
			parseClientMessage(
				JSON.stringify({ type: "comment", text: "x".repeat(5000) }),
			),
		).toBeNull();
	});
});

describe("control message parsing", () => {
	it("accepts steer and well-formed goto", () => {
		expect(
			parseClientMessage(JSON.stringify({ type: "control", action: "steer" })),
		).toEqual({ type: "control", action: "steer" });
		expect(
			parseClientMessage(
				JSON.stringify({ type: "control", action: "release" }),
			),
		).toBeNull();
		expect(
			parseClientMessage(
				JSON.stringify({
					type: "control",
					action: "goto",
					index: 3,
					slideId: "slide-3",
					playing: true,
				}),
			),
		).toEqual({
			type: "control",
			action: "goto",
			index: 3,
			slideId: "slide-3",
			playing: true,
		});
	});

	it("rejects malformed goto payloads", () => {
		for (const bad of [
			{ type: "control", action: "goto" },
			{
				type: "control",
				action: "goto",
				index: -1,
				slideId: null,
				playing: true,
			},
			{
				type: "control",
				action: "goto",
				index: 1.5,
				slideId: null,
				playing: true,
			},
			{
				type: "control",
				action: "goto",
				index: 100000,
				slideId: null,
				playing: true,
			},
			{
				type: "control",
				action: "goto",
				index: 1,
				slideId: "x".repeat(200),
				playing: true,
			},
			{
				type: "control",
				action: "goto",
				index: 1,
				slideId: null,
				playing: "yes",
			},
			{ type: "control", action: "explode" },
		]) {
			expect(parseClientMessage(JSON.stringify(bad))).toBeNull();
		}
	});
});

describe("show control", () => {
	const goto = (index: number) =>
		({
			type: "control",
			action: "goto",
			index,
			slideId: `slide-${index}`,
			playing: true,
		}) as const;

	it("never lets a guest steer", () => {
		expect(
			applyControl(
				IDLE_SHOW_STATE,
				{ type: "control", action: "steer" },
				"g1",
				"guest",
			),
		).toBeNull();
		expect(applyControl(IDLE_SHOW_STATE, goto(1), "g1", "guest")).toBeNull();
	});

	it("lets an admin claim the show and then drive it", () => {
		const claimed = applyControl(
			IDLE_SHOW_STATE,
			{ type: "control", action: "steer" },
			"a1",
			"admin",
		);
		expect(claimed?.presenterId).toBe("a1");
		const moved = applyControl(
			claimed ?? IDLE_SHOW_STATE,
			goto(4),
			"a1",
			"admin",
		);
		expect(moved).toEqual({
			presenterId: "a1",
			index: 4,
			slideId: "slide-4",
			playing: true,
			slideSeconds: null,
		});
	});

	it("ignores goto from an admin who is not the current presenter", () => {
		const state = {
			presenterId: "a1",
			index: 2,
			slideId: "s",
			playing: true,
			slideSeconds: 8,
		};
		expect(applyControl(state, goto(9), "a2", "admin")).toBeNull();
	});

	it("supports takeover by another admin — last steer wins", () => {
		const state = {
			presenterId: "a1",
			index: 2,
			slideId: "s",
			playing: true,
			slideSeconds: 8,
		};
		const taken = applyControl(
			state,
			{ type: "control", action: "steer" },
			"a2",
			"admin",
		);
		expect(taken?.presenterId).toBe("a2");
		expect(applyControl(taken ?? state, goto(9), "a1", "admin")).toBeNull();
		expect(applyControl(taken ?? state, goto(9), "a2", "admin")).toEqual({
			presenterId: "a2",
			index: 9,
			slideId: "slide-9",
			playing: true,
			slideSeconds: 8,
		});
	});
});

describe("tempo", () => {
	const tempo = (slideSeconds: number) =>
		({ type: "control", action: "tempo", slideSeconds }) as const;

	it("lets any admin retime the room without stealing the show", () => {
		const state = {
			presenterId: "a1",
			index: 2,
			slideId: "s",
			playing: true,
			slideSeconds: 8,
		};
		const next = applyControl(state, tempo(4), "a2", "admin");
		expect(next).toEqual({ ...state, slideSeconds: 4 });
	});

	it("starts with no opinion so clients keep the stored tempo", () => {
		expect(IDLE_SHOW_STATE.slideSeconds).toBeNull();
		const claimed = applyControl(
			IDLE_SHOW_STATE,
			{ type: "control", action: "steer" },
			"a1",
			"admin",
		);
		expect(claimed?.slideSeconds).toBeNull();
	});

	it("survives the presenter leaving — the room keeps the couple's tempo", () => {
		const running = applyControl(
			{ ...IDLE_SHOW_STATE, presenterId: "a1" },
			tempo(4),
			"a2",
			"admin",
		);
		expect(running?.slideSeconds).toBe(4);
		// What index.ts does when the presenting connection drops: the show ends,
		// the tempo the couple set does not.
		const afterDisconnect = {
			...IDLE_SHOW_STATE,
			slideSeconds: running?.slideSeconds ?? null,
		};
		expect(afterDisconnect.presenterId).toBeNull();
		expect(afterDisconnect.slideSeconds).toBe(4);
	});

	it("never lets a guest retime the room", () => {
		expect(applyControl(IDLE_SHOW_STATE, tempo(3), "g1", "guest")).toBeNull();
	});

	it("clamps out-of-range tempo instead of trusting the client", () => {
		expect(
			applyControl(IDLE_SHOW_STATE, tempo(999), "a1", "admin")?.slideSeconds,
		).toBe(10);
		expect(
			applyControl(IDLE_SHOW_STATE, tempo(0), "a1", "admin")?.slideSeconds,
		).toBe(2);
	});

	it("parses tempo off the wire and clamps it there too", () => {
		expect(
			parseClientMessage(
				JSON.stringify({ type: "control", action: "tempo", slideSeconds: 42 }),
			),
		).toEqual({ type: "control", action: "tempo", slideSeconds: 10 });
		expect(
			parseClientMessage(
				JSON.stringify({ type: "control", action: "tempo", slideSeconds: "x" }),
			),
		).toBeNull();
	});
});

describe("rate limiter", () => {
	it("blocks a kind after its window limit and recovers after the window", () => {
		const limiter = new RateLimiter({
			reaction: { limit: 2, windowMs: 1000 },
			comment: { limit: 1, windowMs: 1000 },
			control: { limit: 1, windowMs: 1000 },
		});
		expect(limiter.allow("reaction", 0)).toBe(true);
		expect(limiter.allow("reaction", 10)).toBe(true);
		expect(limiter.allow("reaction", 20)).toBe(false);
		expect(limiter.allow("comment", 20)).toBe(true);
		expect(limiter.allow("comment", 30)).toBe(false);
		expect(limiter.allow("reaction", 1500)).toBe(true);
	});
});

describe("comment sanitization", () => {
	it("collapses whitespace and strips control characters", () => {
		expect(sanitizeComment("Na \u001fzdrowie\u2028 młodej   pary")).toBe(
			"Na zdrowie młodej pary",
		);
		expect(sanitizeComment("\u0000\u0001")).toBeNull();
	});
});
