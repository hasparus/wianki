import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	fetch: vi.fn(),
}));

vi.mock("client-only", () => ({}));
vi.mock("browser-image-compression", () => ({
	default: vi.fn(),
}));

import imageCompression from "browser-image-compression";
import {
	makeBlurDataUrl,
	prepareDerivative,
	uploadDerivative,
} from "@/components/upload/upload-client";
import { MAX_DERIVATIVE_BYTES } from "@/lib/domain";

const compress = vi.mocked(imageCompression);

describe("gallery derivative preparation", () => {
	beforeEach(() => {
		vi.clearAllMocks();
		vi.stubGlobal("fetch", mocks.fetch);
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
			// No canvas in this runtime: the photo still goes out, without a blur.
			blurDataUrl: null,
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

	it("builds an 8px blur placeholder the way next/image does for static imports", async () => {
		const jpegBytes = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
		const drawImage = vi.fn();
		const convertToBlob = vi.fn(async () => new Blob([jpegBytes]));
		const sizes: { width: number; height: number }[] = [];
		vi.stubGlobal(
			"OffscreenCanvas",
			class {
				constructor(width: number, height: number) {
					sizes.push({ width, height });
				}
				getContext() {
					return { drawImage };
				}
				convertToBlob = convertToBlob;
			},
		);

		const bitmap = { width: 1600, height: 900, close: vi.fn() };
		const blur = await makeBlurDataUrl(bitmap as unknown as ImageBitmap);

		expect(sizes).toEqual([{ width: 8, height: 5 }]);
		expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 8, 5);
		expect(convertToBlob).toHaveBeenCalledWith({
			type: "image/jpeg",
			quality: 0.7,
		});
		expect(blur).toBe("data:image/jpeg;base64,/9j/2Q==");
		vi.unstubAllGlobals();
	});

	it("returns a clear preparation error when the browser cannot decode HEIC", async () => {
		compress.mockRejectedValueOnce(new Error("decode failed"));

		await expect(
			prepareDerivative(
				new File(["original"], "wesele.heic", { type: "image/heic" }),
			),
		).rejects.toThrow("Nie udało się przygotować zdjęcia");
	});

	it("puts raw JPEG bytes to the derivative endpoint", async () => {
		mocks.fetch.mockResolvedValueOnce(
			Response.json({ ok: true, size: 4 }, { status: 200 }),
		);
		const derivative = new File(["jpeg"], "photo.jpg", {
			type: "image/jpeg",
		});

		await expect(
			uploadDerivative(
				{ photoId: "photo-1", archiveToken: "archive-token" },
				derivative,
			),
		).resolves.toEqual({ error: null });

		expect(mocks.fetch).toHaveBeenCalledWith(
			"/api/uploads/photo-1/derivative",
			expect.objectContaining({
				method: "PUT",
				headers: { "Content-Type": "image/jpeg" },
				body: expect.any(ArrayBuffer),
			}),
		);
	});

	it("returns the server's error so finalization can still record it", async () => {
		mocks.fetch.mockResolvedValueOnce(
			Response.json(
				{ error: "Kopia galeryjna jest zbyt duża." },
				{ status: 413 },
			),
		);
		const result = await uploadDerivative(
			{ photoId: "photo-1", archiveToken: "archive-token" },
			new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
		);
		expect(result.error?.message).toBe("Kopia galeryjna jest zbyt duża.");
	});

	it("normalizes a transport exception so finalization can still run", async () => {
		mocks.fetch.mockRejectedValueOnce(new TypeError("Load failed"));

		const result = await uploadDerivative(
			{ photoId: "photo-1", archiveToken: "archive-token" },
			new File(["jpeg"], "photo.jpg", { type: "image/jpeg" }),
		);

		expect(result.error).toBeInstanceOf(TypeError);
		expect(result.error?.message).toBe("Load failed");
	});
});
