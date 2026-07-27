import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	supabaseBrowser: vi.fn(),
	from: vi.fn(),
	uploadToSignedUrl: vi.fn(),
}));

vi.mock("client-only", () => ({}));
vi.mock("@/lib/supabase/browser", () => ({
	supabaseBrowser: mocks.supabaseBrowser,
}));
vi.mock("browser-image-compression", () => ({
	default: vi.fn(),
}));

import imageCompression from "browser-image-compression";
import {
	prepareDerivative,
	uploadDerivative,
} from "@/components/upload/upload-client";
import { MAX_DERIVATIVE_BYTES } from "@/lib/domain";

const compress = vi.mocked(imageCompression);

describe("gallery derivative preparation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		mocks.from.mockReturnValue({
			uploadToSignedUrl: mocks.uploadToSignedUrl,
		});
		mocks.supabaseBrowser.mockReturnValue({
			storage: { from: mocks.from },
		});
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => ({
				width: 1600,
				height: 900,
				close: vi.fn(),
			})),
		);
	});

	it("creates one predictable JPEG below the gallery limit", async () => {
		const jpegDerivative = new File(["jpeg"], "wesele.jpg", {
			type: "image/jpeg",
		});
		compress.mockResolvedValueOnce(jpegDerivative);

		const result = await prepareDerivative(
			new File(["original"], "wesele.heic", { type: "image/heic" }),
		);

		expect(result).toMatchObject({
			derivative: jpegDerivative,
			width: 1600,
			height: 900,
		});
		expect(compress).toHaveBeenCalledOnce();
		expect(compress).toHaveBeenCalledWith(
			expect.any(File),
			expect.objectContaining({
				fileType: "image/jpeg",
				maxSizeMB: 0.4,
				maxWidthOrHeight: 1920,
				preserveExif: false,
			}),
		);
	});

	it.each([
		new File([], "empty.jpg", { type: "image/jpeg" }),
		new File(["png"], "wrong.png", { type: "image/png" }),
		new File([new Uint8Array(MAX_DERIVATIVE_BYTES + 1)], "large.jpg", {
			type: "image/jpeg",
		}),
	])("rejects invalid compression output before uploading", async (output) => {
		compress.mockResolvedValueOnce(output);

		await expect(
			prepareDerivative(
				new File(["original"], "wesele.jpg", { type: "image/jpeg" }),
			),
		).rejects.toThrow("mniejszego niż 500 KB");
		expect(createImageBitmap).not.toHaveBeenCalled();
	});

	it("returns a clear preparation error when the browser cannot decode HEIC", async () => {
		compress.mockRejectedValueOnce(new Error("decode failed"));

		await expect(
			prepareDerivative(
				new File(["original"], "wesele.heic", { type: "image/heic" }),
			),
		).rejects.toThrow("Nie udało się przygotować zdjęcia");
	});

	it("uploads raw JPEG bytes instead of Blob FormData", async () => {
		mocks.uploadToSignedUrl.mockResolvedValueOnce({
			data: { path: "batch/photo.jpg" },
			error: null,
		});
		const derivative = new File(["jpeg"], "photo.jpg", {
			type: "image/jpeg",
		});

		await expect(
			uploadDerivative(
				{
					photoId: "photo-1",
					path: "batch/photo.jpg",
					uploadToken: "token",
					archiveToken: "archive-token",
				},
				derivative,
			),
		).resolves.toEqual({ error: null });

		expect(mocks.uploadToSignedUrl).toHaveBeenCalledWith(
			"batch/photo.jpg",
			"token",
			expect.any(ArrayBuffer),
			{
				cacheControl: "3600",
				contentType: "image/jpeg",
			},
		);
	});

	it("normalizes a transport exception so finalization can still run", async () => {
		mocks.uploadToSignedUrl.mockRejectedValueOnce(new TypeError("Load failed"));

		const result = await uploadDerivative(
			{
				photoId: "photo-1",
				path: "batch/photo.jpg",
				uploadToken: "token",
				archiveToken: "archive-token",
			},
			new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
		);

		expect(result.error).toBeInstanceOf(TypeError);
		expect(result.error?.message).toBe("Load failed");
	});
});
