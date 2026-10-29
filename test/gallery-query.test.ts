import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));

import { GET as getImage } from "@/app/api/photos/[photoId]/image/route";
import { createAdminSession, createGuestSession } from "@/lib/auth/session";
import { run } from "@/lib/db";
import { GALLERY_PAGE_SIZE } from "@/lib/domain";
import { getGalleryPage, getGalleryStats } from "@/lib/gallery";
import { derivativeKey } from "@/lib/storage";
import { getSiteUsage } from "@/lib/usage";
import { insertPhoto, setupSite, siteRequest } from "./helpers/site";

let context: Awaited<ReturnType<typeof setupSite>>;

beforeEach(async () => {
	vi.clearAllMocks();
	context = await setupSite();
});

describe("gallery query", () => {
	it("shows only uploaded + approved photos of this site, newest first, with a cursor", async () => {
		const base = Date.parse("2026-08-08T18:00:00.000Z");
		for (let index = 0; index < GALLERY_PAGE_SIZE + 2; index++) {
			await insertPhoto(context.site.id, {
				hotStatus: "uploaded",
				moderationStatus: "approved",
				createdAt: new Date(base + index * 1000).toISOString(),
			});
		}
		await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			moderationStatus: "pending",
		});
		await insertPhoto(context.site.id, {
			hotStatus: "failed",
			moderationStatus: "approved",
		});
		await run(
			"insert into accounts (id, email) values ('a2', 'b@example.com')",
		);
		await run(
			`insert into sites (id, account_id, slug, title, guest_entry_token, admin_entry_token)
			 values ('s2', 'a2', 'inna', 'Inna', 'g', 'a')`,
		);
		await insertPhoto("s2", {
			hotStatus: "uploaded",
			moderationStatus: "approved",
		});

		const first = await getGalleryPage(context.site.id);
		expect(first.items).toHaveLength(GALLERY_PAGE_SIZE);
		expect(first.nextCursor).not.toBeNull();
		expect(first.items[0].createdAt > first.items[1].createdAt).toBe(true);
		expect(first.items[0].imageUrl).toBe(
			`/api/photos/${first.items[0].id}/image`,
		);
		const second = await getGalleryPage(context.site.id, first.nextCursor);
		expect(second.items).toHaveLength(2);
		expect(second.nextCursor).toBeNull();
		expect(await getGalleryStats(context.site.id)).toEqual({
			approvedPhotos: GALLERY_PAGE_SIZE + 2,
		});
		expect(await getGalleryStats("s2")).toEqual({ approvedPhotos: 1 });
	});

	it("rejects a malformed cursor", async () => {
		await expect(getGalleryPage(context.site.id, "zzz")).rejects.toThrow(
			/kursor/,
		);
	});
});

describe("usage", () => {
	it("sums archived originals and live derivatives only", async () => {
		await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			archiveStatus: "uploaded",
			originalSize: 100,
			derivativeSize: 10,
		});
		await insertPhoto(context.site.id, {
			hotStatus: "deleted",
			archiveStatus: "trashed",
			originalSize: 100,
			derivativeSize: 10,
		});
		await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			archiveStatus: "failed",
			originalSize: 100,
			derivativeSize: 10,
		});
		expect(await getSiteUsage(context.site.id)).toEqual({
			archiveBytes: 100,
			derivativeBytes: 20,
			photoCount: 2,
		});
	});
});

describe("derivative image route", () => {
	it("serves approved photos to guests and everything uploaded to admins", async () => {
		const approved = await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			moderationStatus: "approved",
		});
		const pending = await insertPhoto(context.site.id, {
			hotStatus: "uploaded",
			moderationStatus: "pending",
		});
		for (const photo of [approved, pending]) {
			await context.GALLERY.put(
				derivativeKey(context.site.id, photo.storagePath),
				new TextEncoder().encode("jpeg-bytes"),
			);
		}
		const fetchImage = (id: string) =>
			getImage(siteRequest(context.site, `/api/photos/${id}/image`), {
				params: Promise.resolve({ photoId: id }),
			});

		mocks.get.mockReturnValue(undefined);
		expect((await fetchImage(approved.id)).status).toBe(401);

		const guest = await createGuestSession(context.site);
		mocks.get.mockImplementation((name: string) =>
			name === "__Host-wianki_guest" ? { value: guest } : undefined,
		);
		const ok = await fetchImage(approved.id);
		expect(ok.status).toBe(200);
		expect(ok.headers.get("cache-control")).toBe("private, max-age=3600");
		expect(await ok.text()).toBe("jpeg-bytes");
		expect((await fetchImage(pending.id)).status).toBe(404);

		const admin = await createAdminSession(context.site);
		mocks.get.mockImplementation((name: string) =>
			name === "__Host-wianki_admin" ? { value: admin } : undefined,
		);
		expect((await fetchImage(pending.id)).status).toBe(200);
	});
});
