import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ set: vi.fn() }));

vi.mock("next/headers", () => ({
	cookies: async () => ({ set: mocks.set }),
}));

import { POST } from "@/app/api/auth/guest/route";
import {
	ADMIN_COOKIE,
	GUEST_COOKIE,
	readAdminSession,
	readGuestSession,
} from "@/lib/auth/session";
import { setupSite, siteRequest } from "./helpers/site";

const GUEST = "guest-passphrase-here";
const ADMIN = "admin-passphrase-much-longer";

let context: Awaited<ReturnType<typeof setupSite>>;

beforeEach(async () => {
	vi.clearAllMocks();
	context = await setupSite({ guestPassphrase: GUEST, adminPassphrase: ADMIN });
});

function submit(passphrase: string) {
	const form = new FormData();
	form.set("passphrase", passphrase);
	return POST(
		siteRequest(context.site, "/api/auth/guest", {
			method: "POST",
			body: form,
		}),
	);
}

describe("passphrase login", () => {
	it("gives the guest passphrase a guest cookie and the gallery", async () => {
		const response = await submit(GUEST);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, redirect: "/" });
		const [name, token] = mocks.set.mock.calls[0];
		expect(name).toBe(GUEST_COOKIE);
		expect(await readGuestSession(context.site, token)).toMatchObject({
			role: "guest",
			siteId: context.site.id,
		});
	});

	it("gives the admin passphrase an admin cookie and the panel", async () => {
		const response = await submit(ADMIN);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, redirect: "/admin" });
		const [name, token] = mocks.set.mock.calls[0];
		expect(name).toBe(ADMIN_COOKIE);
		expect(await readAdminSession(context.site, token)).toEqual({
			role: "admin",
			siteId: context.site.id,
		});
	});

	it("rejects a wrong passphrase without setting any cookie", async () => {
		const response = await submit("nope");
		expect(response.status).toBe(401);
		expect(mocks.set).not.toHaveBeenCalled();
	});

	it("rejects a request from another origin", async () => {
		const form = new FormData();
		form.set("passphrase", GUEST);
		const response = await POST(
			siteRequest(context.site, "/api/auth/guest", {
				method: "POST",
				body: form,
				headers: { origin: "https://evil.example" },
			}),
		);
		expect(response.status).toBe(403);
	});

	it("answers 404 on the platform host", async () => {
		const form = new FormData();
		form.set("passphrase", GUEST);
		const response = await POST(
			new Request("https://wianki.test/api/auth/guest", {
				method: "POST",
				body: form,
				headers: { host: "wianki.test", origin: "https://wianki.test" },
			}),
		);
		expect(response.status).toBe(404);
	});
});
