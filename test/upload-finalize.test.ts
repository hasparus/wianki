import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readGuestSession: vi.fn(),
	verifyArchiveReceipt: vi.fn(),
	moderateImage: vi.fn(),
	supabaseAdmin: vi.fn(),
}));

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

describe("upload finalization", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.readGuestSession.mockResolvedValue({ guestId: "guest-1" });
	});

	it("records a successful Drive upload when the gallery derivative is missing", async () => {
		const update = vi.fn();
		const updateEq = vi.fn().mockResolvedValue({ error: null });
		const photoQuery = {
			select: vi.fn(),
			eq: vi.fn(),
			single: vi.fn().mockResolvedValue({
				data: {
					id: "photo-1",
					storage_path: "batch/photo.webp",
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
		update.mockReturnValue({ eq: updateEq });
		mocks.supabaseAdmin.mockReturnValue({
			from: vi.fn().mockReturnValue(photoQuery),
			storage: {
				from: vi.fn().mockReturnValue({
					download: vi
						.fn()
						.mockResolvedValue({ data: null, error: new Error("missing") }),
				}),
			},
		});
		mocks.verifyArchiveReceipt.mockResolvedValue({
			photoId: "photo-1",
			size: 8,
			driveFileId: "drive-1",
		});

		const response = await POST(
			new Request("https://wedding.pawel.space/api/uploads/photo-1/finalize", {
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
			}),
			{ params: Promise.resolve({ photoId: "photo-1" }) },
		);

		expect(response.status).toBe(400);
		expect(update).toHaveBeenCalledWith({
			hot_status: "failed",
			archive_status: "uploaded",
			drive_file_id: "drive-1",
			last_error: "Nieprawidłowa kopia galeryjna.",
		});
	});
});
