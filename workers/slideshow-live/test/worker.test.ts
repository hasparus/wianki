import { SignJWT } from "jose";
import { describe, expect, it } from "vitest";
import { SLIDESHOW_LIVE_AUDIENCE } from "../../../lib/slideshow-protocol";
import worker, { authorizeConnection, type Env } from "../src/index";

const secret = "0123456789abcdef0123456789abcdef";
const room = "22222222-2222-4222-8222-222222222222";
const otherRoom = "33333333-3333-4333-8333-333333333333";
const origin = "https://rosia.wianki.app";

async function token(claims: Record<string, unknown> = {}) {
	return new SignJWT({ role: "guest", room, origin, ...claims })
		.setProtectedHeader({ alg: "HS256", typ: "JWT" })
		.setIssuedAt()
		.setAudience(SLIDESHOW_LIVE_AUDIENCE)
		.setExpirationTime("1h")
		.sign(new TextEncoder().encode(secret));
}

function socketRequest(
	roomInPath: string,
	accessToken: string | null,
	requestOrigin: string | null = origin,
) {
	const url = new URL(
		`https://live.example/parties/slideshow-party/${roomInPath}`,
	);
	if (accessToken) url.searchParams.set("token", accessToken);
	return new Request(url, {
		headers: {
			Upgrade: "websocket",
			...(requestOrigin ? { Origin: requestOrigin } : {}),
		},
	});
}

describe("authorizeConnection", () => {
	it("admits a token for this room from the site's own origin", async () => {
		const result = await authorizeConnection(
			socketRequest(room, await token({ role: "admin" })),
			room,
			secret,
		);
		expect(result).toEqual({ role: "admin", room, origin });
	});

	it("refuses a missing or forged token with 401", async () => {
		const missing = await authorizeConnection(
			socketRequest(room, null),
			room,
			secret,
		);
		expect(missing).toBeInstanceOf(Response);
		expect((missing as Response).status).toBe(401);
		const forged = await authorizeConnection(
			socketRequest(room, await token()),
			room,
			"another-secret-another-secret-32b!",
		);
		expect((forged as Response).status).toBe(401);
	});

	it("keeps a token for one wedding out of another wedding's room", async () => {
		const result = await authorizeConnection(
			socketRequest(otherRoom, await token()),
			otherRoom,
			secret,
		);
		expect((result as Response).status).toBe(403);
	});

	it("refuses an Origin other than the one signed into the token", async () => {
		for (const bad of [
			null,
			"https://kasia.wianki.app",
			"https://evil.example",
		]) {
			const result = await authorizeConnection(
				socketRequest(room, await token(), bad),
				room,
				secret,
			);
			expect((result as Response).status).toBe(403);
		}
	});

	it("accepts a custom domain when the token was signed for it", async () => {
		const custom = "https://wesele.example.com";
		const result = await authorizeConnection(
			socketRequest(room, await token({ origin: custom }), custom),
			room,
			secret,
		);
		expect(result).toEqual({ role: "guest", room, origin: custom });
	});
});

/** A namespace that records which room PartyServer resolved and answers for it. */
function fakeEnv(reached: string[]): Env {
	const namespace = {
		idFromName: (name: string) => ({ name }),
		get: (id: { name: string }) => ({
			fetch: async () => {
				reached.push(id.name);
				return new Response("connected", { status: 200 });
			},
		}),
	};
	return {
		SlideshowParty: namespace as unknown as Env["SlideshowParty"],
		LIVE_TOKEN_SECRET: secret,
	};
}

describe("routing", () => {
	it("routes /parties/slideshow-party/<room> and checks the token against that room", async () => {
		const reached: string[] = [];
		const ok = await worker.fetch(
			socketRequest(room, await token()),
			fakeEnv(reached),
		);
		expect(ok.status).toBe(200);
		expect(reached).toEqual([room]);

		const wrongRoom = await worker.fetch(
			socketRequest(otherRoom, await token()),
			fakeEnv(reached),
		);
		expect(wrongRoom.status).toBe(403);
		expect(reached).toEqual([room]);
	});

	it("stops a bad origin and a missing token before the room is touched", async () => {
		const reached: string[] = [];
		const env = fakeEnv(reached);
		expect(
			(
				await worker.fetch(
					socketRequest(room, await token(), "https://evil.example"),
					env,
				)
			).status,
		).toBe(403);
		expect((await worker.fetch(socketRequest(room, null), env)).status).toBe(
			401,
		);
		expect(reached).toEqual([]);
	});

	it("answers 404 off the party path", async () => {
		const response = await worker.fetch(
			new Request("https://live.example/anything"),
			fakeEnv([]),
		);
		expect(response.status).toBe(404);
	});
});
