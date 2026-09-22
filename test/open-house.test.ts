import { NextRequest } from "next/server";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	serverEnv: vi.fn(),
	createGuestSession: vi.fn(),
}));

vi.mock("@/lib/env", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/env")>()),
	serverEnv: mocks.serverEnv,
}));
vi.mock("@/lib/auth/session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/session")>()),
	createGuestSession: mocks.createGuestSession,
}));

import { GUEST_COOKIE } from "@/lib/auth/session";
import { ServerEnvError } from "@/lib/env";
import { proxy } from "@/proxy";

const tomorrow = new Date(Date.now() + 86_400_000);
const yesterday = new Date(Date.now() - 86_400_000);

function visit(path: string, cookie?: string) {
	const request = new NextRequest(new URL(path, "https://wianki.vercel.app"));
	if (cookie) request.cookies.set(GUEST_COOKIE, cookie);
	return proxy(request);
}

function openUntil(date?: Date) {
	mocks.serverEnv.mockReturnValue({
		GUEST_ENTRY_TOKEN: "entry-token",
		ADMIN_ENTRY_TOKEN: "admin-token",
		GUEST_OPEN_UNTIL: date,
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.createGuestSession.mockResolvedValue("guest-jwt");
});

describe("invalid server environment", () => {
	it("shows Zod-derived issues on page requests", async () => {
		mocks.serverEnv.mockImplementation(() => {
			throw new ServerEnvError([
				{ key: "APP_ORIGIN", reason: "brak wartości" },
				{ key: "<unsafe>", reason: "Nieprawidłowy adres & wartość" },
			]);
		});

		const response = await visit("/");
		const body = await response.text();

		expect(response.status).toBe(500);
		expect(response.headers.get("content-type")).toBe(
			"text/html; charset=utf-8",
		);
		expect(body).toContain("Nie udało się uruchomić strony");
		expect(body).toContain("APP_ORIGIN");
		expect(body).toContain("brak wartości");
		expect(body).toContain("&lt;unsafe&gt;");
		expect(body).toContain("Nieprawidłowy adres &amp; wartość");
		expect(body).not.toContain("<unsafe>");
	});

	it("returns structured issues to API clients", async () => {
		mocks.serverEnv.mockImplementation(() => {
			throw new ServerEnvError([{ key: "APP_ORIGIN", reason: "Invalid URL" }]);
		});

		const response = await visit("/api/gallery");

		expect(response.status).toBe(500);
		await expect(response.json()).resolves.toEqual({
			error: "Środowisko serwera jest źle skonfigurowane.",
			issues: [{ key: "APP_ORIGIN", reason: "Invalid URL" }],
		});
	});

	it("does not hide unexpected proxy errors", async () => {
		mocks.serverEnv.mockImplementation(() => {
			throw new Error("unexpected");
		});

		await expect(visit("/")).rejects.toThrow("unexpected");
	});
});

describe("open house window", () => {
	it("hands the gallery a guest session while the window is open", async () => {
		openUntil(tomorrow);
		const response = await visit("/");
		expect(response.status).toBe(200);
		expect(response.cookies.get(GUEST_COOKIE)?.value).toBe("guest-jwt");
	});

	it("sends a visitor who lands on the login form to the gallery", async () => {
		openUntil(tomorrow);
		const response = await visit("/login");
		expect(response.headers.get("location")).toBe("https://wianki.vercel.app/");
		expect(response.cookies.get(GUEST_COOKIE)?.value).toBe("guest-jwt");
	});

	it("leaves an existing session alone", async () => {
		openUntil(tomorrow);
		await visit("/", "already-signed-in");
		expect(mocks.createGuestSession).not.toHaveBeenCalled();
	});

	it("asks for the passphrase again once the window closes", async () => {
		openUntil(yesterday);
		const response = await visit("/");
		expect(response.headers.get("location")).toBe(
			"https://wianki.vercel.app/login",
		);
		expect(mocks.createGuestSession).not.toHaveBeenCalled();
	});

	it("asks for the passphrase when no window is configured", async () => {
		openUntil(undefined);
		const response = await visit("/");
		expect(response.headers.get("location")).toBe(
			"https://wianki.vercel.app/login",
		);
	});
});
