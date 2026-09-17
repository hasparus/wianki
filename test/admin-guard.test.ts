import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverEnv: vi.fn(), get: vi.fn() }));

vi.mock("@/lib/env", () => ({ serverEnv: mocks.serverEnv }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));

import { denyAdminRequest } from "@/lib/auth/session";

const ORIGIN = "https://wianki.vercel.app";

function request(origin?: string) {
	return new Request(`${ORIGIN}/api/admin/slides`, {
		method: "POST",
		headers: origin ? { origin } : {},
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.serverEnv.mockReturnValue({
		APP_ORIGIN: ORIGIN,
		ADMIN_SESSION_SECRET: "0123456789abcdef0123456789abcdef",
	});
});

describe("denyAdminRequest", () => {
	it("rejects a request without an admin cookie", async () => {
		mocks.get.mockReturnValue(undefined);
		expect((await denyAdminRequest(request(ORIGIN)))?.status).toBe(401);
	});

	it("rejects a cross-origin request even with an admin cookie", async () => {
		const { createAdminSession } = await import("@/lib/auth/session");
		mocks.get.mockReturnValue({ value: await createAdminSession() });
		expect(
			(await denyAdminRequest(request("https://evil.example")))?.status,
		).toBe(403);
		expect((await denyAdminRequest(request()))?.status).toBe(403);
	});

	it("lets a same-origin admin request through", async () => {
		const { createAdminSession } = await import("@/lib/auth/session");
		mocks.get.mockReturnValue({ value: await createAdminSession() });
		expect(await denyAdminRequest(request(ORIGIN))).toBeNull();
	});
});
