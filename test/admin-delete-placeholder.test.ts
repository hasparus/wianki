import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	denyAdminRequest: vi.fn(),
	supabaseAdmin: vi.fn(),
}));
vi.mock("@/lib/auth/session", () => ({
	denyAdminRequest: mocks.denyAdminRequest,
}));
vi.mock("@/lib/supabase/server", () => ({
	supabaseAdmin: mocks.supabaseAdmin,
}));

import { DELETE } from "@/app/api/admin/photos/[photoId]/route";

function mockBackend(storageError: Error | null) {
	const single = vi.fn().mockResolvedValue({
		data: {
			id: "photo-1",
			storage_path: "private/photo.jpg",
			archive_key: null,
			original_size: 12,
		},
		error: null,
	});
	const eq = vi.fn().mockReturnValue({ single });
	const updateEq = vi.fn().mockResolvedValue({ error: null });
	const update = vi.fn().mockReturnValue({ eq: updateEq });
	const insert = vi.fn().mockResolvedValue({ error: null });
	mocks.supabaseAdmin.mockReturnValue({
		from: vi.fn((table: string) =>
			table === "photos"
				? { select: vi.fn().mockReturnValue({ eq }), update }
				: { insert },
		),
		storage: {
			from: vi.fn().mockReturnValue({
				remove: vi.fn().mockResolvedValue({ error: storageError }),
			}),
		},
	});
	return update;
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.denyAdminRequest.mockResolvedValue(null);
});

describe("admin deletion", () => {
	it.each([
		{ storageError: null, hotStatus: "deleted" },
		{ storageError: new Error("Storage unavailable"), hotStatus: "failed" },
	])(
		"clears the preview when the derivative removal leaves $hotStatus",
		async ({ storageError, hotStatus }) => {
			const update = mockBackend(storageError);
			const response = await DELETE(
				new Request("https://wedding.example/api/admin/photos/photo-1", {
					method: "DELETE",
				}),
				{ params: Promise.resolve({ photoId: "photo-1" }) },
			);

			expect(response.status).toBe(200);
			expect(update).toHaveBeenCalledWith(
				expect.objectContaining({
					hot_status: hotStatus,
					blur_data_url: null,
					moderation_status: "rejected",
				}),
			);
		},
	);
});
