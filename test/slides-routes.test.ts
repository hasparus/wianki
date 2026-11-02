import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));

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
import { createAdminSession, createGuestSession } from "@/lib/auth/session";
import { all } from "@/lib/db";
import { getSlideshowDeck } from "@/lib/slideshow";
import { insertPhoto, setupSite, siteRequest } from "./helpers/site";

const params = { params: Promise.resolve({ slideId: "s-1" }) };
let context: Awaited<ReturnType<typeof setupSite>>;

function request(method: string, path = "/api/admin/slides", body?: unknown) {
	return siteRequest(context.site, path, {
		method,
		headers: { "Content-Type": "application/json" },
		body: body === undefined ? undefined : JSON.stringify(body),
	});
}

beforeEach(async () => {
	vi.clearAllMocks();
	context = await setupSite();
});

describe("admin slide routes require an admin session", () => {
	it("rejects every handler with 401 when the admin cookie is absent", async () => {
		mocks.get.mockReturnValue(undefined);
		const responses = await Promise.all([
			listSlides(request("GET")),
			createSlides(request("POST", "/api/admin/slides", { title: "Hej" })),
			reorderSlides(request("PATCH", "/api/admin/slides", { order: ["a"] })),
			updateSlide(
				request("PATCH", "/api/admin/slides/s-1", { title: "Hej" }),
				params,
			),
			deleteSlide(request("DELETE", "/api/admin/slides/s-1"), params),
			getPickerPhotos(request("GET", "/api/admin/slides/photos")),
		]);
		for (const response of responses) {
			expect(response.status).toBe(401);
		}
	});
});

describe("slide editing", () => {
	beforeEach(async () => {
		mocks.get.mockReturnValue({
			value: await createAdminSession(context.site),
		});
	});

	it("rejects an order that is not a permutation of current slides", async () => {
		await createSlides(request("POST", "/api/admin/slides", { title: "A" }));
		await createSlides(request("POST", "/api/admin/slides", { title: "B" }));
		const response = await reorderSlides(
			request("PATCH", "/api/admin/slides", {
				order: ["11111111-1111-4111-8111-111111111111"],
			}),
		);
		expect(response.status).toBe(409);
	});

	it("adds only approved photos of this site and skips the rest", async () => {
		const approved = await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			moderationStatus: "approved",
		});
		const hidden = await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			moderationStatus: "rejected",
		});
		const response = await createSlides(
			request("POST", "/api/admin/slides", {
				photoIds: [approved.id, hidden.id],
			}),
		);
		expect(await response.json()).toEqual({ added: 1, skipped: 1 });
		const deck = await getSlideshowDeck(context.site.id);
		expect(deck.source).toBe("custom");
		expect(deck.slides.map((slide) => slide.imageUrl)).toEqual([
			`/api/photos/${approved.id}/image`,
		]);
	});

	it("reorders atomically and edits only text slides", async () => {
		await createSlides(request("POST", "/api/admin/slides", { title: "A" }));
		await createSlides(request("POST", "/api/admin/slides", { title: "B" }));
		const rows = await all<{ id: string }>(
			"select id from slideshow_slides order by position",
		);
		const reversed = rows.map((row) => row.id).reverse();
		const reorder = await reorderSlides(
			request("PATCH", "/api/admin/slides", { order: reversed }),
		);
		expect(reorder.status).toBe(200);
		const after = await all<{ id: string }>(
			"select id from slideshow_slides order by position",
		);
		expect(after.map((row) => row.id)).toEqual(reversed);

		const edit = await updateSlide(
			request("PATCH", `/api/admin/slides/${reversed[0]}`, { title: "Nowy" }),
			{ params: Promise.resolve({ slideId: reversed[0] }) },
		);
		expect(edit.status).toBe(200);
		const missing = await deleteSlide(
			request("DELETE", "/api/admin/slides/x"),
			{
				params: Promise.resolve({ slideId: "nope" }),
			},
		);
		expect(missing.status).toBe(404);
	});
});

describe("slideshow live access", () => {
	it("rejects visitors without any session", async () => {
		mocks.get.mockReturnValue(undefined);
		const response = await getLiveAccess(request("GET", "/api/slideshow/live"));
		expect(response.status).toBe(401);
	});

	it("returns a null live config when the worker is not configured", async () => {
		mocks.get.mockReturnValue({
			value: await createGuestSession(context.site),
		});
		const response = await getLiveAccess(request("GET", "/api/slideshow/live"));
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ live: null });
	});
});
