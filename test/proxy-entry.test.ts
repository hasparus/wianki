import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("next/headers", () => ({
	cookies: async () => ({ get: () => undefined }),
}));

import { GET as enter } from "@/app/api/auth/enter/route";
import { GUEST_COOKIE, readGuestSession } from "@/lib/auth/session";
import { setBindingsForTests } from "@/lib/cloudflare";
import { resetServerEnvCache } from "@/lib/env";
import { proxy } from "@/proxy";
import { createTestBucket, createTestD1 } from "./helpers/d1";
import { setupSite } from "./helpers/site";

const tomorrow = new Date(Date.now() + 86_400_000).toISOString();
const yesterday = new Date(Date.now() - 86_400_000).toISOString();
const SITE = "https://rosia.wianki.test";

function visit(path: string, cookie?: string, origin = SITE) {
	const request = new NextRequest(new URL(path, origin), {
		headers: { host: new URL(origin).host },
	});
	if (cookie) request.cookies.set(GUEST_COOKIE, cookie);
	return proxy(request);
}

beforeEach(async () => {
	await setupSite();
});

describe("invalid server environment", () => {
	beforeEach(() => {
		// Bindings without PLATFORM_HOST: the real schema produces the error.
		setBindingsForTests({ DB: createTestD1(), GALLERY: createTestBucket() });
		resetServerEnvCache();
	});

	it("shows Zod-derived issues on page requests", async () => {
		const response = await visit("/");
		const body = await response.text();
		expect(response.status).toBe(500);
		expect(response.headers.get("content-type")).toBe(
			"text/html; charset=utf-8",
		);
		expect(body).toContain("Nie udało się uruchomić strony");
		expect(body).toContain(
			"<code>PLATFORM_HOST</code><span>brak wartości</span>",
		);
		expect(body).toContain("SESSION_SECRET");
	});

	it("returns structured issues to API clients", async () => {
		const response = await visit("/api/gallery");
		expect(response.status).toBe(500);
		const body = (await response.json()) as {
			error: string;
			issues: unknown[];
		};
		expect(body.error).toBe("Środowisko serwera jest źle skonfigurowane.");
		expect(body.issues).toEqual(
			expect.arrayContaining([
				{ key: "PLATFORM_HOST", reason: "brak wartości" },
			]),
		);
	});
});

describe("proxy routing", () => {
	it("sends a first visit on a site host to the entry handler", async () => {
		const response = await visit("/");
		expect(response.headers.get("location")).toBe(
			`${SITE}/api/auth/enter?next=%2F`,
		);
	});

	it("exchanges an entry token through the entry handler", async () => {
		const response = await visit("/?token=abc");
		expect(response.headers.get("location")).toBe(
			`${SITE}/api/auth/enter?token=abc&next=%2F`,
		);
	});

	it("lets a signed-in guest through", async () => {
		const response = await visit("/", "already-signed-in");
		expect(response.status).toBe(200);
		expect(response.headers.get("location")).toBeNull();
	});

	it("hides the owner console on a site host and the gallery on the platform host", async () => {
		expect((await visit("/konto", "x")).status).toBe(404);
		expect(
			(await visit("/login", undefined, "https://wianki.test")).status,
		).toBe(404);
		const owner = await visit("/konto", undefined, "https://wianki.test");
		expect(owner.headers.get("location")).toBe(
			"https://wianki.test/konto/login?next=%2Fkonto",
		);
	});
});

describe("entry handler", () => {
	function enterRequest(query: string) {
		return new Request(`${SITE}/api/auth/enter?${query}`, {
			headers: { host: "rosia.wianki.test" },
		});
	}

	function cookieFrom(response: Response) {
		return response.headers
			.get("set-cookie")
			?.match(/__Host-wianki_guest=([^;]+)/)?.[1];
	}

	it("hands the gallery a guest session while the open house is on", async () => {
		const { site } = await setupSite({ guestOpenUntil: tomorrow });
		const response = await enter(enterRequest("next=%2F"));
		expect(response.headers.get("location")).toBe(`${SITE}/`);
		const token = cookieFrom(response);
		expect(await readGuestSession(site, token)).not.toBeNull();
	});

	it("sends a visitor who lands on the login form to the gallery", async () => {
		await setupSite({ guestOpenUntil: tomorrow });
		const response = await enter(enterRequest("next=%2Flogin"));
		expect(response.headers.get("location")).toBe(`${SITE}/`);
	});

	it("asks for the passphrase once the window closes", async () => {
		await setupSite({ guestOpenUntil: yesterday });
		const response = await enter(enterRequest("next=%2F"));
		expect(response.headers.get("location")).toBe(`${SITE}/login`);
		expect(cookieFrom(response)).toBeUndefined();
	});

	it("accepts the guest entry token and strips it from the URL", async () => {
		const { site } = await setupSite();
		const response = await enter(
			enterRequest(`token=${site.guest_entry_token}&next=%2F`),
		);
		expect(response.headers.get("location")).toBe(`${SITE}/`);
		expect(await readGuestSession(site, cookieFrom(response))).not.toBeNull();
	});

	it("ignores a wrong token and still cleans the URL", async () => {
		await setupSite();
		const response = await enter(enterRequest("token=wrong&next=%2F"));
		expect(response.headers.get("location")).toBe(`${SITE}/`);
		expect(cookieFrom(response)).toBeUndefined();
	});

	it("exchanges the join code for a guest session on the slideshow", async () => {
		const { site } = await setupSite({ guestJoinCode: "stol-7" });
		const response = await enter(enterRequest("code=stol-7&next=%2Fpokaz"));
		expect(response.headers.get("location")).toBe(`${SITE}/pokaz`);
		expect(await readGuestSession(site, cookieFrom(response))).not.toBeNull();
		const wrong = await enter(enterRequest("code=nope"));
		expect(wrong.headers.get("location")).toBe(`${SITE}/login`);
	});

	it("never redirects off-site", async () => {
		await setupSite({ guestOpenUntil: tomorrow });
		const response = await enter(
			enterRequest("next=https%3A%2F%2Fevil.example"),
		);
		expect(response.headers.get("location")).toBe(`${SITE}/`);
	});
});
