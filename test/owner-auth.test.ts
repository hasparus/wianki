import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	sendMagicLink: vi.fn(),
}));

vi.mock("next/headers", () => ({
	cookies: async () => ({ get: mocks.get }),
	headers: async () => new Headers(),
}));
vi.mock("@/lib/mail", () => ({ sendMagicLink: mocks.sendMagicLink }));

import { POST as logout } from "@/app/api/auth/owner/logout/route";
import { POST as requestLink } from "@/app/api/auth/owner/request/route";
import { GET as verify } from "@/app/api/auth/owner/verify/route";
import { POST as rotate } from "@/app/api/konto/sites/[siteId]/rotate/route";
import { PATCH as patchSite } from "@/app/api/konto/sites/[siteId]/route";
import { POST as createSiteRoute } from "@/app/api/konto/sites/route";
import { issueLoginToken } from "@/lib/accounts";
import { createOwnerSession, OWNER_COOKIE } from "@/lib/auth/session";
import { first, run } from "@/lib/db";
import { findSiteById } from "@/lib/sites";
import { setupSite } from "./helpers/site";

const ORIGIN = "https://wianki.test";
const OTHER_ACCOUNT = "99999999-9999-4999-8999-999999999999";

function platformRequest(
	path: string,
	init: RequestInit & { sameOrigin?: boolean; json?: unknown } = {},
) {
	const headers = new Headers(init.headers);
	headers.set("host", "wianki.test");
	if (init.sameOrigin !== false) headers.set("origin", ORIGIN);
	let body = init.body;
	if (init.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(init.json);
	}
	return new Request(`${ORIGIN}${path}`, { ...init, headers, body });
}

async function signInAs(accountId: string) {
	const jwt = await createOwnerSession(accountId);
	mocks.get.mockImplementation((name: string) =>
		name === OWNER_COOKIE ? { value: jwt } : undefined,
	);
}

function signedOut() {
	mocks.get.mockReturnValue(undefined);
}

const siteContext = (siteId: string) => ({
	params: Promise.resolve({ siteId }),
});

beforeEach(() => {
	vi.clearAllMocks();
	signedOut();
	mocks.sendMagicLink.mockImplementation(
		async (_email: string, url: string) => ({
			delivered: false,
			devLink: url,
		}),
	);
});

describe("magic link request", () => {
	it("issues a token, mails a verify link and echoes it outside production", async () => {
		await setupSite();
		const response = await requestLink(
			platformRequest("/api/auth/owner/request", {
				method: "POST",
				json: { email: "Owner@example.com" },
			}),
		);
		expect(response.status).toBe(200);
		const body = await response.json();
		expect(body.ok).toBe(true);
		expect(body.devLink).toMatch(
			/^https:\/\/wianki\.test\/konto\/login\/verify\?token=/,
		);
		expect(mocks.sendMagicLink).toHaveBeenCalledWith(
			"owner@example.com",
			body.devLink,
		);
		const stored = await first<{ email: string }>(
			"select email from login_tokens",
		);
		expect(stored?.email).toBe("owner@example.com");
	});

	it("refuses a cross-origin or malformed request", async () => {
		await setupSite();
		expect(
			(
				await requestLink(
					platformRequest("/api/auth/owner/request", {
						method: "POST",
						sameOrigin: false,
						json: { email: "owner@example.com" },
					}),
				)
			).status,
		).toBe(403);
		expect(
			(
				await requestLink(
					platformRequest("/api/auth/owner/request", {
						method: "POST",
						json: { email: "nope" },
					}),
				)
			).status,
		).toBe(400);
		expect(mocks.sendMagicLink).not.toHaveBeenCalled();
	});

	it("with sign-ups closed, answers 200 but mails only known addresses", async () => {
		await setupSite({}, { SIGNUP_ENABLED: "false" });
		const unknown = await requestLink(
			platformRequest("/api/auth/owner/request", {
				method: "POST",
				json: { email: "stranger@example.com" },
			}),
		);
		expect(unknown.status).toBe(200);
		expect(await unknown.json()).toEqual({ ok: true });
		expect(mocks.sendMagicLink).not.toHaveBeenCalled();
		expect(await first("select 1 as one from login_tokens")).toBeNull();

		const known = await requestLink(
			platformRequest("/api/auth/owner/request", {
				method: "POST",
				json: { email: "owner@example.com" },
			}),
		);
		expect(known.status).toBe(200);
		expect(mocks.sendMagicLink).toHaveBeenCalledTimes(1);
	});

	it("reports a delivery failure instead of pretending", async () => {
		await setupSite();
		mocks.sendMagicLink.mockRejectedValue(new Error("brak nadawcy"));
		const response = await requestLink(
			platformRequest("/api/auth/owner/request", {
				method: "POST",
				json: { email: "owner@example.com" },
			}),
		);
		expect(response.status).toBe(500);
	});
});

describe("magic link verify", () => {
	it("turns a fresh token into an owner cookie once", async () => {
		await setupSite();
		const { token } = await issueLoginToken("owner@example.com");
		const path = `/api/auth/owner/verify?token=${encodeURIComponent(token)}`;

		const response = await verify(platformRequest(path));
		expect(response.status).toBe(307);
		expect(response.headers.get("location")).toBe(`${ORIGIN}/konto`);
		const cookie = response.headers.get("set-cookie") ?? "";
		expect(cookie).toContain(`${OWNER_COOKIE}=`);
		expect(cookie).toContain("HttpOnly");
		expect(cookie).toContain("Secure");

		const again = await verify(platformRequest(path));
		expect(again.headers.get("location")).toBe(
			`${ORIGIN}/konto/login?error=expired`,
		);
		expect(again.headers.get("set-cookie")).toBeNull();
	});

	it("sends a missing or bogus token back to the form", async () => {
		await setupSite();
		for (const path of [
			"/api/auth/owner/verify",
			"/api/auth/owner/verify?token=bogus",
		]) {
			const response = await verify(platformRequest(path));
			expect(response.headers.get("location")).toBe(
				`${ORIGIN}/konto/login?error=expired`,
			);
		}
	});
});

describe("logout", () => {
	it("clears the cookie and goes home", async () => {
		await setupSite();
		const response = await logout(
			platformRequest("/api/auth/owner/logout", { method: "POST" }),
		);
		expect(response.status).toBe(303);
		expect(response.headers.get("location")).toBe(`${ORIGIN}/`);
		expect(response.headers.get("set-cookie")).toMatch(
			new RegExp(`${OWNER_COOKIE}=;.*Max-Age=0`),
		);
		expect(
			(
				await logout(
					platformRequest("/api/auth/owner/logout", {
						method: "POST",
						sameOrigin: false,
					}),
				)
			).status,
		).toBe(403);
	});
});

describe("site routes authorize the owner", () => {
	it("rejects anonymous and cross-origin requests", async () => {
		const { site, accountId } = await setupSite();
		const anonymous = await patchSite(
			platformRequest(`/api/konto/sites/${site.id}`, {
				method: "PATCH",
				json: { title: "Nowy" },
			}),
			siteContext(site.id),
		);
		expect(anonymous.status).toBe(401);

		await signInAs(accountId);
		const crossOrigin = await patchSite(
			platformRequest(`/api/konto/sites/${site.id}`, {
				method: "PATCH",
				sameOrigin: false,
				json: { title: "Nowy" },
			}),
			siteContext(site.id),
		);
		expect(crossOrigin.status).toBe(403);
		expect((await findSiteById(site.id))?.title).toBe("Rosia & Piotrek");
	});

	it("answers 404 to another signed-in account", async () => {
		const { site } = await setupSite();
		await run("insert into accounts (id, email) values (?, ?)", [
			OTHER_ACCOUNT,
			"someone-else@example.com",
		]);
		await signInAs(OTHER_ACCOUNT);
		const patched = await patchSite(
			platformRequest(`/api/konto/sites/${site.id}`, {
				method: "PATCH",
				json: { title: "Przejęte" },
			}),
			siteContext(site.id),
		);
		expect(patched.status).toBe(404);
		const rotated = await rotate(
			platformRequest(`/api/konto/sites/${site.id}/rotate`, {
				method: "POST",
				json: { which: "admin" },
			}),
			siteContext(site.id),
		);
		expect(rotated.status).toBe(404);
		const after = await findSiteById(site.id);
		expect(after?.title).toBe("Rosia & Piotrek");
		expect(after?.admin_entry_token).toBe(site.admin_entry_token);
	});

	it("lets the owner update, rotate and create", async () => {
		const { site, accountId } = await setupSite();
		await signInAs(accountId);

		const patched = await patchSite(
			platformRequest(`/api/konto/sites/${site.id}`, {
				method: "PATCH",
				json: { title: "Rosia i Piotrek", moderationEnabled: true },
			}),
			siteContext(site.id),
		);
		expect(patched.status).toBe(200);
		const patchedBody = await patched.json();
		expect(patchedBody.site).toMatchObject({
			title: "Rosia i Piotrek",
			moderationEnabled: true,
		});
		expect(JSON.stringify(patchedBody)).not.toContain("entry_token");
		expect(JSON.stringify(patchedBody)).not.toContain("hash");

		const invalid = await patchSite(
			platformRequest(`/api/konto/sites/${site.id}`, {
				method: "PATCH",
				json: { customDomain: "nope" },
			}),
			siteContext(site.id),
		);
		expect(invalid.status).toBe(400);

		const rotated = await rotate(
			platformRequest(`/api/konto/sites/${site.id}/rotate`, {
				method: "POST",
				json: { which: "guest" },
			}),
			siteContext(site.id),
		);
		expect(rotated.status).toBe(200);
		const rotatedBody = await rotated.json();
		expect(rotatedBody.guestUrl).not.toContain(site.guest_entry_token);
		expect(rotatedBody.guestUrl).toMatch(
			/^https:\/\/rosia\.wianki\.test\/\?token=/,
		);

		const created = await createSiteRoute(
			platformRequest("/api/konto/sites", {
				method: "POST",
				json: {
					slug: "ania-tomek",
					title: "Ania & Tomek",
					guestPassphrase: "wesele 2026",
					adminPassphrase: "admin passphrase long",
					deletionContactEmail: "ania@example.com",
				},
			}),
		);
		expect(created.status).toBe(201);
		const createdBody = await created.json();
		expect(createdBody.site.origin).toBe("https://ania-tomek.wianki.test");
		expect((await findSiteById(createdBody.site.id))?.account_id).toBe(
			accountId,
		);

		const reserved = await createSiteRoute(
			platformRequest("/api/konto/sites", {
				method: "POST",
				json: {
					slug: "konto",
					title: "X",
					guestPassphrase: "wesele 2026",
					adminPassphrase: "admin passphrase long",
					deletionContactEmail: "ania@example.com",
				},
			}),
		);
		expect(reserved.status).toBe(400);
	});
});
