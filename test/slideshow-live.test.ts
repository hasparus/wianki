import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverEnv: vi.fn() }));
vi.mock("@/lib/env", () => ({ serverEnv: mocks.serverEnv }));

import { createSlideshowLiveAccess } from "@/lib/slideshow-live";
import {
	IDLE_SHOW_STATE,
	resolveShowIndex,
	SLIDESHOW_PARTY,
	verifyLiveToken,
} from "@/lib/slideshow-protocol";

const secret = "0123456789abcdef0123456789abcdef";
const site = {
	id: "22222222-2222-4222-8222-222222222222",
	origin: "https://rosia.wianki.app",
};

describe("slideshow live tokens", () => {
	beforeEach(() => {
		mocks.serverEnv.mockReturnValue({
			SLIDESHOW_LIVE_URL: "https://wedding-slideshow-live.example.workers.dev",
			SLIDESHOW_LIVE_SECRET: secret,
		});
	});

	it("returns null when the live layer is not configured", async () => {
		mocks.serverEnv.mockReturnValue({});
		expect(await createSlideshowLiveAccess(site, "guest")).toBeNull();
	});

	it("mints a token the worker-side verifier accepts, for this site's room and origin", async () => {
		const access = await createSlideshowLiveAccess(site, "guest");
		expect(access?.host).toBe("wedding-slideshow-live.example.workers.dev");
		expect(access?.party).toBe(SLIDESHOW_PARTY);
		expect(access?.room).toBe(site.id);
		expect(access?.role).toBe("guest");
		expect(await verifyLiveToken(access?.token ?? "", secret)).toEqual({
			role: "guest",
			room: site.id,
			origin: site.origin,
		});
	});

	it("binds an admin token to the same room, with the admin role", async () => {
		const access = await createSlideshowLiveAccess(site, "admin");
		expect(await verifyLiveToken(access?.token ?? "", secret)).toEqual({
			role: "admin",
			room: site.id,
			origin: site.origin,
		});
	});

	it("gives each site its own room and origin", async () => {
		const other = await createSlideshowLiveAccess(
			{
				id: "33333333-3333-4333-8333-333333333333",
				origin: "https://wesele.example.com",
			},
			"guest",
		);
		expect(other?.room).not.toBe(site.id);
		expect(await verifyLiveToken(other?.token ?? "", secret)).toEqual({
			role: "guest",
			room: "33333333-3333-4333-8333-333333333333",
			origin: "https://wesele.example.com",
		});
	});

	it("maps show state onto a local deck by slide id, then clamped index", () => {
		const show = {
			...IDLE_SHOW_STATE,
			presenterId: "p1",
			index: 5,
			slideId: "b",
		};
		expect(resolveShowIndex(show, ["a", "b", "c"])).toBe(1);
		expect(resolveShowIndex({ ...show, slideId: "missing" }, ["a", "b"])).toBe(
			1,
		);
		expect(resolveShowIndex({ ...show, slideId: null, index: -3 }, ["a"])).toBe(
			0,
		);
		expect(resolveShowIndex(show, [])).toBeNull();
	});

	it("rejects a token signed with another secret", async () => {
		const access = await createSlideshowLiveAccess(site, "admin");
		expect(
			await verifyLiveToken(
				access?.token ?? "",
				"another-secret-another-secret-32b!",
			),
		).toBeNull();
	});
});
