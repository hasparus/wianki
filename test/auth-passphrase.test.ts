import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	serverEnv: vi.fn(),
	set: vi.fn(),
	createGuestSession: vi.fn(),
	createAdminSession: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ serverEnv: mocks.serverEnv }));
vi.mock("next/headers", () => ({
	cookies: async () => ({ set: mocks.set }),
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/session")>()),
	createGuestSession: mocks.createGuestSession,
	createAdminSession: mocks.createAdminSession,
}));
vi.mock("@/lib/http", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/http")>()),
	assertSameOrigin: vi.fn(),
}));

import { POST } from "@/app/api/auth/guest/route";

const GUEST = "guest-passphrase-here";
const ADMIN = "admin-passphrase-much-longer";

function submit(passphrase: string) {
	const form = new FormData();
	form.set("passphrase", passphrase);
	return POST(
		new Request("https://wianki.vercel.app/api/auth/guest", {
			method: "POST",
			body: form,
		}),
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createGuestSession.mockResolvedValue("guest-jwt");
	mocks.createAdminSession.mockResolvedValue("admin-jwt");
	mocks.serverEnv.mockReturnValue({
		GUEST_ACCESS_PASSPHRASE: GUEST,
		ADMIN_ACCESS_PASSPHRASE: ADMIN,
	});
});

describe("passphrase login", () => {
	it("gives the guest passphrase a guest cookie and the gallery", async () => {
		const response = await submit(GUEST);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, redirect: "/" });
		expect(mocks.set).toHaveBeenCalledWith(
			"__Host-wedding_guest",
			"guest-jwt",
			expect.anything(),
		);
		expect(mocks.createAdminSession).not.toHaveBeenCalled();
	});

	it("gives the admin passphrase an admin cookie and the panel", async () => {
		const response = await submit(ADMIN);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, redirect: "/admin" });
		expect(mocks.set).toHaveBeenCalledWith(
			"__Host-wedding_admin",
			"admin-jwt",
			expect.anything(),
		);
		expect(mocks.createGuestSession).not.toHaveBeenCalled();
	});

	it("rejects a wrong passphrase without setting any cookie", async () => {
		const response = await submit("nope");
		expect(response.status).toBe(401);
		expect(mocks.set).not.toHaveBeenCalled();
	});

	it("never mints an admin session when no admin passphrase is configured", async () => {
		mocks.serverEnv.mockReturnValue({ GUEST_ACCESS_PASSPHRASE: GUEST });
		const rejected = await submit(ADMIN);
		expect(rejected.status).toBe(401);
		expect(mocks.createAdminSession).not.toHaveBeenCalled();

		const accepted = await submit(GUEST);
		expect(accepted.status).toBe(200);
		expect(mocks.set).toHaveBeenCalledWith(
			"__Host-wedding_guest",
			"guest-jwt",
			expect.anything(),
		);
	});

	it("rejects a missing passphrase field", async () => {
		const response = await POST(
			new Request("https://wianki.vercel.app/api/auth/guest", {
				method: "POST",
				body: new FormData(),
			}),
		);
		expect(response.status).toBe(401);
		expect(mocks.set).not.toHaveBeenCalled();
	});
});
