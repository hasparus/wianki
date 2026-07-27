import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	after: vi.fn(),
	readGuestSession: vi.fn(),
	verifyArchiveReceipt: vi.fn(),
	moderateImage: vi.fn(),
	supabaseAdmin: vi.fn(),
}));

vi.mock("next/server", () => ({ after: mocks.after }));
vi.mock("@/lib/auth/session", () => ({
	readGuestSession: mocks.readGuestSession,
}));
vi.mock("@/lib/archive-token", () => ({
	verifyArchiveReceipt: mocks.verifyArchiveReceipt,
}));
vi.mock("@/lib/moderation", () => ({
	moderateImage: mocks.moderateImage,
}));
vi.mock("@/lib/supabase/server", () => ({
	supabaseAdmin: mocks.supabaseAdmin,
}));
vi.mock("@/lib/http", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/http")>()),
	assertSameOrigin: vi.fn(),
}));

import { POST } from "@/app/api/uploads/[photoId]/finalize/route";

function finalizeRequest() {
	return new Request(
		"https://wedding.pawel.space/api/uploads/photo-1/finalize",
		{
			method: "POST",
			headers: {
				"Content-Type": "application/json",
				Origin: "https://wedding.pawel.space",
			},
			body: JSON.stringify({
				archiveReceipt: "receipt",
				archiveError: null,
				derivativeSize: 4,
				derivativeType: "image/jpeg",
				width: 2,
				height: 2,
			}),
		},
	);
}

function mockBackend(image: Blob | null) {
	const updateEq = vi.fn().mockResolvedValue({ error: null });
	const update = vi.fn().mockReturnValue({ eq: updateEq });
	const photoQuery = {
		select: vi.fn(),
		eq: vi.fn(),
		single: vi.fn().mockResolvedValue({
			data: {
				id: "photo-1",
				storage_path: "batch/photo.jpg",
				original_size: 8,
				archive_status: "pending",
				drive_file_id: null,
			},
			error: null,
		}),
		update,
	};
	photoQuery.select.mockReturnValue(photoQuery);
	photoQuery.eq.mockReturnValue(photoQuery);
	const eventInsert = vi.fn().mockResolvedValue({ error: null });
	const client = {
		from: vi.fn((table: string) =>
			table === "photos" ? photoQuery : { insert: eventInsert },
		),
		storage: {
			from: vi.fn().mockReturnValue({
				download: vi
					.fn()
					.mockResolvedValue(
						image
							? { data: image, error: null }
							: { data: null, error: new Error("missing") },
					),
			}),
		},
	};
	mocks.supabaseAdmin.mockReturnValue(client);
	return { update, eventInsert };
}

describe("upload finalization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readGuestSession.mockResolvedValue({ guestId: "guest-1" });
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: "photo-1",
			size: 8,
			driveFileId: "drive-1",
		});
	});

	it("records a successful Drive upload when the gallery derivative is missing", async () => {
		const { update } = mockBackend(null);

		const response = await POST(finalizeRequest(), {
			params: Promise.resolve({ photoId: "photo-1" }),
		});

		expect(response.status).toBe(400);
		expect(update).toHaveBeenCalledWith({
			hot_status: "failed",
			archive_status: "uploaded",
			drive_file_id: "drive-1",
			last_error: "Nieprawidłowa kopia galeryjna.",
		});
		expect(mocks.after).not.toHaveBeenCalled();
	});

	it("persists both copies and responds before moderation starts", async () => {
		const image = new Blob(["jpeg"], { type: "image/jpeg" });
		const { update } = mockBackend(image);
		mocks.moderateImage.mockResolvedValue({
			status: "approved",
			scores: {
				adult: "UNLIKELY",
				racy: "UNLIKELY",
				violence: "UNLIKELY",
			},
		});

		const response = await POST(finalizeRequest(), {
			params: Promise.resolve({ photoId: "photo-1" }),
		});
		const body = await response.json();

		expect(response.status).toBe(200);
		expect(body).toMatchObject({
			ok: true,
			archiveStatus: "uploaded",
			moderationStatus: "pending",
		});
		expect(update).toHaveBeenCalledWith({
			hot_status: "uploaded",
			archive_status: "uploaded",
			moderation_status: "pending",
			drive_file_id: "drive-1",
			derivative_size: 4,
			derivative_content_type: "image/jpeg",
			width: 2,
			height: 2,
			moderation_scores: null,
			last_error: null,
		});
		expect(mocks.moderateImage).not.toHaveBeenCalled();
		expect(mocks.after).toHaveBeenCalledOnce();
	});

	it("updates moderation after the response has been accepted", async () => {
		const image = new Blob(["jpeg"], { type: "image/jpeg" });
		const { update, eventInsert } = mockBackend(image);
		const scores = {
			adult: "UNLIKELY",
			racy: "UNLIKELY",
			violence: "UNLIKELY",
		};
		mocks.moderateImage.mockResolvedValue({
			status: "approved",
			scores,
		});

		await POST(finalizeRequest(), {
			params: Promise.resolve({ photoId: "photo-1" }),
		});
		const moderationTask = mocks.after.mock.calls[0][0] as () => Promise<void>;
		await moderationTask();

		expect(update).toHaveBeenLastCalledWith({
			moderation_status: "approved",
			moderation_scores: scores,
			last_error: null,
		});
		expect(eventInsert).toHaveBeenCalledWith({
			photo_id: "photo-1",
			actor: "vision",
			action: "approved",
			details: scores,
		});
	});

	it("routes background moderation failures to manual review", async () => {
		const image = new Blob(["jpeg"], { type: "image/jpeg" });
		const { update, eventInsert } = mockBackend(image);
		mocks.moderateImage.mockRejectedValue(new Error("Vision niedostępny."));

		await POST(finalizeRequest(), {
			params: Promise.resolve({ photoId: "photo-1" }),
		});
		const moderationTask = mocks.after.mock.calls[0][0] as () => Promise<void>;
		await moderationTask();

		expect(update).toHaveBeenLastCalledWith({
			moderation_status: "review_required",
			moderation_scores: null,
			last_error: "Vision niedostępny.",
		});
		expect(eventInsert).toHaveBeenCalledWith({
			photo_id: "photo-1",
			actor: "system",
			action: "review_required",
			details: { error: "Vision niedostępny." },
		});
	});
});
