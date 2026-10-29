import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	after: vi.fn(),
	cookies: vi.fn(),
	verifyArchiveReceipt: vi.fn(),
	moderateImage: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("next/headers", () => ({ cookies: mocks.cookies }));
vi.mock("@/lib/archive-token", () => ({
	verifyArchiveReceipt: mocks.verifyArchiveReceipt,
}));
vi.mock("@/lib/moderation", () => ({
	moderateImage: mocks.moderateImage,
}));

import { POST } from "@/app/api/uploads/[photoId]/finalize/route";
import { createGuestSession, GUEST_COOKIE } from "@/lib/auth/session";
import { first } from "@/lib/db";
import { MAX_BLUR_DATA_URL_LENGTH } from "@/lib/domain";
import { derivativeKey } from "@/lib/storage";
import { insertPhoto, setupSite, siteRequest } from "./helpers/site";

const blurDataUrl = `data:image/jpeg;base64,${Buffer.from([
	0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0xff, 0xd9,
]).toString("base64")}`;

type Context = Awaited<ReturnType<typeof setupSite>> & {
	photoId: string;
	storagePath: string;
};

async function setup(
	options: { moderationEnabled?: boolean; withDerivative?: boolean } = {},
): Promise<Context> {
	const context = await setupSite(
		{ moderationEnabled: options.moderationEnabled ?? false },
		options.moderationEnabled
			? {
					GOOGLE_VISION_CLIENT_EMAIL: "vision@example.iam.gserviceaccount.com",
					GOOGLE_VISION_PRIVATE_KEY: "key",
				}
			: {},
	);
	const guestId = "33333333-3333-4333-8333-333333333333";
	const photo = await insertPhoto(context.site.id, {
		guestId,
		originalSize: 8,
	});
	if (options.withDerivative !== false) {
		await context.GALLERY.put(
			derivativeKey(context.site.id, photo.storagePath),
			new TextEncoder().encode("jpeg"),
		);
	}
	const token = await createGuestSession(context.site, guestId);
	mocks.cookies.mockResolvedValue({
		get: (name: string) =>
			name === GUEST_COOKIE ? { value: token } : undefined,
	});
	return { ...context, photoId: photo.id, storagePath: photo.storagePath };
}

function finalize(context: Context, extra: Record<string, unknown> = {}) {
	return POST(
		siteRequest(context.site, `/api/uploads/${context.photoId}/finalize`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				archiveReceipt: "receipt",
				archiveError: null,
				derivativeSize: 4,
				derivativeType: "image/jpeg",
				width: 2,
				height: 2,
				...extra,
			}),
		}),
		{ params: Promise.resolve({ photoId: context.photoId }) },
	);
}

async function photoRow(photoId: string) {
	return first<Record<string, unknown>>("select * from photos where id = ?", [
		photoId,
	]);
}

describe("upload finalization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("records a successful archive upload when the gallery derivative is missing", async () => {
		const context = await setup({ withDerivative: false });
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: context.photoId,
			size: 8,
			archiveKey: "sites/x/originals/a",
		});

		const response = await finalize(context);

		expect(response.status).toBe(400);
		expect(await photoRow(context.photoId)).toMatchObject({
			hot_status: "failed",
			archive_status: "uploaded",
			archive_key: "sites/x/originals/a",
			last_error: "Nieprawidłowa kopia galeryjna.",
		});
		expect(mocks.after).not.toHaveBeenCalled();
	});

	it("persists both copies and responds before moderation starts", async () => {
		const context = await setup({ moderationEnabled: true });
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: context.photoId,
			size: 8,
			archiveKey: "sites/x/originals/a",
		});

		const response = await finalize(context);
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			ok: true,
			archiveStatus: "uploaded",
			moderationStatus: "pending",
		});
		expect(await photoRow(context.photoId)).toMatchObject({
			hot_status: "uploaded",
			archive_status: "uploaded",
			moderation_status: "pending",
			archive_key: "sites/x/originals/a",
			derivative_size: 4,
			derivative_content_type: "image/jpeg",
			width: 2,
			height: 2,
			blur_data_url: null,
			last_error: null,
		});
		expect(mocks.moderateImage).not.toHaveBeenCalled();
		expect(mocks.after).toHaveBeenCalledOnce();
	});

	it("auto-approves and records a system event when the site skips moderation", async () => {
		const context = await setup();
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: context.photoId,
			size: 8,
			archiveKey: "k",
		});

		const response = await finalize(context);
		expect((await response.json()).moderationStatus).toBe("approved");
		// Run the deferred work the way next/server's after() would.
		await mocks.after.mock.calls[0][0]();
		const event = await first<{ actor: string; action: string }>(
			"select actor, action from moderation_events where photo_id = ?",
			[context.photoId],
		);
		expect(event).toEqual({ actor: "system", action: "approved" });
		expect(mocks.moderateImage).not.toHaveBeenCalled();
	});

	it("stores a small JPEG blur placeholder next to the derivative", async () => {
		const context = await setup();
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: context.photoId,
			size: 8,
			archiveKey: "k",
		});
		const response = await finalize(context, { blurDataUrl });
		expect(response.status).toBe(200);
		expect(await photoRow(context.photoId)).toMatchObject({
			hot_status: "uploaded",
			blur_data_url: blurDataUrl,
		});
	});

	it("drops an oversized placeholder without failing the photo", async () => {
		const context = await setup();
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: context.photoId,
			size: 8,
			archiveKey: "k",
		});
		const response = await finalize(context, {
			blurDataUrl: `data:image/jpeg;base64,${"A".repeat(MAX_BLUR_DATA_URL_LENGTH)}`,
		});
		expect(response.status).toBe(200);
		expect(await photoRow(context.photoId)).toMatchObject({
			hot_status: "uploaded",
			blur_data_url: null,
		});
	});

	it("keeps the photo when the receipt names another photo", async () => {
		const context = await setup();
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: "other",
			size: 8,
			archiveKey: "k",
		});
		const response = await finalize(context);
		expect((await response.json()).archiveStatus).toBe("failed");
		expect(await photoRow(context.photoId)).toMatchObject({
			hot_status: "uploaded",
			archive_status: "failed",
			archive_key: null,
			last_error: "Potwierdzenie dotyczy innego zdjęcia.",
		});
	});

	it("refuses a guest who does not own the photo", async () => {
		const context = await setup();
		const stranger = await createGuestSession(context.site);
		mocks.cookies.mockResolvedValue({
			get: () => ({ value: stranger }),
		});
		const response = await finalize(context);
		expect(response.status).toBe(404);
	});

	it("refuses a cross-origin request", async () => {
		const context = await setup();
		const response = await POST(
			siteRequest(context.site, `/api/uploads/${context.photoId}/finalize`, {
				method: "POST",
				headers: {
					"Content-Type": "application/json",
					origin: "https://evil.example",
				},
				body: "{}",
			}),
			{ params: Promise.resolve({ photoId: context.photoId }) },
		);
		expect(response.status).toBe(403);
	});
});
