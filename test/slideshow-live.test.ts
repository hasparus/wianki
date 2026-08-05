import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ serverEnv: vi.fn() }));
vi.mock("@/lib/env", () => ({ serverEnv: mocks.serverEnv }));

import {
	createSlideshowLiveAccess,
	verifySlideshowLiveToken,
} from "@/lib/slideshow-live";

const secret = "0123456789abcdef0123456789abcdef";

describe("slideshow live tokens", () => {
	beforeEach(() => {
		mocks.serverEnv.mockReturnValue({
			SLIDESHOW_LIVE_URL: "https://wedding-slideshow-live.example.workers.dev",
			SLIDESHOW_LIVE_SECRET: secret,
		});
	});

	it("returns null when the live layer is not configured", async () => {
		mocks.serverEnv.mockReturnValue({});
		expect(await createSlideshowLiveAccess("guest")).toBeNull();
	});

	it("mints a token the worker-side verifier accepts", async () => {
		const access = await createSlideshowLiveAccess("guest");
		expect(access?.host).toBe("wedding-slideshow-live.example.workers.dev");
		expect(access?.room).toBe("wesele");
		expect(await verifySlideshowLiveToken(access?.token ?? "", secret)).toBe(
			"guest",
		);
	});

	it("rejects a token signed with another secret", async () => {
		const access = await createSlideshowLiveAccess("admin");
		expect(
			await verifySlideshowLiveToken(
				access?.token ?? "",
				"another-secret-another-secret-32b!",
			),
		).toBeNull();
	});
});
