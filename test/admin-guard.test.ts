import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));

vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));

import { createAdminSession, denyAdminRequest } from "@/lib/auth/session";
import { setupSite, siteRequest } from "./helpers/site";

let context: Awaited<ReturnType<typeof setupSite>>;

beforeEach(async () => {
	vi.clearAllMocks();
	context = await setupSite();
});

describe("denyAdminRequest", () => {
	it("rejects a request without an admin cookie", async () => {
		mocks.get.mockReturnValue(undefined);
		const request = siteRequest(context.site, "/api/admin/slides", {
			method: "POST",
		});
		expect((await denyAdminRequest(request, context.site))?.status).toBe(401);
	});

	it("rejects a cross-origin request even with an admin cookie", async () => {
		mocks.get.mockReturnValue({
			value: await createAdminSession(context.site),
		});
		const evil = siteRequest(context.site, "/api/admin/slides", {
			method: "POST",
			headers: { origin: "https://evil.example" },
		});
		expect((await denyAdminRequest(evil, context.site))?.status).toBe(403);
		const none = siteRequest(context.site, "/api/admin/slides", {
			method: "POST",
			sameOrigin: false,
		});
		expect((await denyAdminRequest(none, context.site))?.status).toBe(403);
	});

	it("lets a same-origin admin request through", async () => {
		mocks.get.mockReturnValue({
			value: await createAdminSession(context.site),
		});
		const request = siteRequest(context.site, "/api/admin/slides", {
			method: "POST",
		});
		expect(await denyAdminRequest(request, context.site)).toBeNull();
	});
});
