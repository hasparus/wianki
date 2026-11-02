import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({ get: vi.fn(), after: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: async () => ({ get: mocks.get }) }));
vi.mock("next/server", () => ({ after: mocks.after }));

import { DELETE } from "@/app/api/admin/photos/[photoId]/route";
import { createAdminSession } from "@/lib/auth/session";
import { first } from "@/lib/db";
import { derivativeKey } from "@/lib/storage";
import { insertPhoto, setupSite, siteRequest } from "./helpers/site";

beforeEach(() => {
	vi.clearAllMocks();
});

describe("admin deletion", () => {
	it.each([
		{ storageError: false, hotStatus: "deleted" },
		{ storageError: true, hotStatus: "failed" },
	])(
		"clears the preview when the derivative removal leaves $hotStatus",
		async ({ storageError, hotStatus }) => {
			const context = await setupSite();
			const photo = await insertPhoto(context.site.id, {
				hotStatus: "uploaded",
				moderationStatus: "approved",
			});
			await context.GALLERY.put(
				derivativeKey(context.site.id, photo.storagePath),
				new Uint8Array([1]),
			);
			if (storageError) {
				vi.spyOn(context.GALLERY, "delete").mockRejectedValueOnce(
					new Error("Storage unavailable"),
				);
			}
			mocks.get.mockReturnValue({
				value: await createAdminSession(context.site),
			});

			const response = await DELETE(
				siteRequest(context.site, `/api/admin/photos/${photo.id}`, {
					method: "DELETE",
				}),
				{ params: Promise.resolve({ photoId: photo.id }) },
			);

			expect(response.status).toBe(200);
			expect(
				await first("select * from photos where id = ?", [photo.id]),
			).toMatchObject({
				hot_status: hotStatus,
				blur_data_url: null,
				moderation_status: "rejected",
				archive_status: "failed",
			});
			expect(
				await first("select action from moderation_events where photo_id = ?", [
					photo.id,
				]),
			).toEqual({
				action: storageError ? "deletion_partial" : "deleted",
			});
			if (!storageError) {
				expect(context.GALLERY.objects.size).toBe(0);
			}
		},
	);

	it("does not delete a photo that belongs to another site", async () => {
		const context = await setupSite();
		const photo = await insertPhoto(context.site.id, { hotStatus: "uploaded" });
		const otherSite = {
			...context.site,
			id: "99999999-9999-4999-8999-999999999999",
		};
		mocks.get.mockReturnValue({
			value: await createAdminSession(context.site),
		});
		// The request arrives on the right host, but we pretend the photo is elsewhere.
		const response = await DELETE(
			siteRequest(context.site, `/api/admin/photos/${photo.id}`, {
				method: "DELETE",
			}),
			{
				params: Promise.resolve({
					photoId: "00000000-0000-4000-8000-000000000000",
				}),
			},
		);
		expect(response.status).toBe(404);
		expect(otherSite.id).not.toBe(context.site.id);
	});
});
