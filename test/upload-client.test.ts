import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("client-only", () => ({}));
vi.mock("@/lib/supabase/browser", () => ({
	supabaseBrowser: vi.fn(),
}));
vi.mock("browser-image-compression", () => ({
	default: vi.fn(),
}));

import imageCompression from "browser-image-compression";
import { prepareDerivative } from "@/components/upload/upload-client";

const compress = vi.mocked(imageCompression);

describe("gallery derivative preparation", () => {
	beforeEach(() => {
		compress.mockReset();
		vi.stubGlobal(
			"createImageBitmap",
			vi.fn(async () => ({
				width: 1600,
				height: 900,
				close: vi.fn(),
			})),
		);
	});

	it("accepts PNG when the browser returns it for WebP encoding", async () => {
		const pngDerivative = new File(["png"], "wesele.jpg", {
			type: "image/png",
		});
		compress.mockResolvedValueOnce(pngDerivative);

		const result = await prepareDerivative(
			new File(["original"], "wesele.jpg", { type: "image/jpeg" }),
		);

		expect(result).toMatchObject({
			derivative: pngDerivative,
			width: 1600,
			height: 900,
		});
		expect(compress).toHaveBeenCalledOnce();
		expect(compress).toHaveBeenCalledWith(
			expect.any(File),
			expect.objectContaining({ fileType: "image/webp" }),
		);
	});
});
