import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	denyAdminRequest: vi.fn(),
	readAdminSession: vi.fn(),
	readGuestSession: vi.fn(),
	supabaseAdmin: vi.fn(),
	serverEnv: vi.fn(),
	getAdminSlides: vi.fn(),
	getGalleryPage: vi.fn(),
}));

vi.mock("@/lib/env", () => ({ serverEnv: mocks.serverEnv }));
vi.mock("@/lib/auth/session", () => ({
	denyAdminRequest: mocks.denyAdminRequest,
	readAdminSession: mocks.readAdminSession,
	readGuestSession: mocks.readGuestSession,
}));
vi.mock("@/lib/supabase/server", () => ({
	supabaseAdmin: mocks.supabaseAdmin,
}));
vi.mock("@/lib/gallery", () => ({ getGalleryPage: mocks.getGalleryPage }));
vi.mock("@/lib/slideshow", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/slideshow")>()),
	getAdminSlides: mocks.getAdminSlides,
}));

import {
	DELETE as deleteSlide,
	PATCH as updateSlide,
} from "@/app/api/admin/slides/[slideId]/route";
import { GET as getPickerPhotos } from "@/app/api/admin/slides/photos/route";
import {
	POST as createSlides,
	GET as listSlides,
	PATCH as reorderSlides,
} from "@/app/api/admin/slides/route";
import { GET as getLiveAccess } from "@/app/api/slideshow/live/route";

const params = { params: Promise.resolve({ slideId: "s-1" }) };

function request(method: string, body?: unknown) {
	return new Request("https://wedding.pawel.space/api/admin/slides", {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.serverEnv.mockReturnValue({});
});

describe("admin slide routes require an admin session", () => {
	it("rejects every handler with 401 when the admin cookie is absent", async () => {
		mocks.readAdminSession.mockResolvedValue(null);
		mocks.denyAdminRequest.mockResolvedValue(
			Response.json({ error: "Brak dostępu." }, { status: 401 }),
		);
		const responses = await Promise.all([
			listSlides(),
			createSlides(request("POST", { title: "Hej" })),
			reorderSlides(request("PATCH", { order: ["a"] })),
			updateSlide(request("PATCH", { title: "Hej" }), params),
			deleteSlide(request("DELETE"), params),
			getPickerPhotos(request("GET")),
		]);
		for (const response of responses) {
			expect(response.status).toBe(401);
		}
		expect(mocks.supabaseAdmin).not.toHaveBeenCalled();
	});
});

describe("slide reorder", () => {
	it("rejects an order that is not a permutation of current slides", async () => {
		mocks.readAdminSession.mockResolvedValue({ role: "admin" });
		mocks.denyAdminRequest.mockResolvedValue(null);
		mocks.supabaseAdmin.mockReturnValue({
			from: () => ({
				select: async () => ({
					data: [{ id: "a" }, { id: "b" }],
					error: null,
				}),
			}),
		});
		const response = await reorderSlides(
			request("PATCH", { order: ["11111111-1111-4111-8111-111111111111"] }),
		);
		expect(response.status).toBe(409);
	});
});

describe("slideshow live access", () => {
	it("rejects visitors without any session", async () => {
		mocks.readGuestSession.mockResolvedValue(null);
		mocks.readAdminSession.mockResolvedValue(null);
		const response = await getLiveAccess();
		expect(response.status).toBe(401);
	});

	it("returns a null live config when the worker is not configured", async () => {
		mocks.readGuestSession.mockResolvedValue({
			role: "guest",
			guestId: "g-1",
		});
		const response = await getLiveAccess();
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ live: null });
	});
});
