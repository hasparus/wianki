import sharp from "sharp";
import { parseBlurDataUrl } from "../../lib/blur-placeholder.ts";
import { BLUR_IMAGE_QUALITY, BLUR_IMAGE_SIZE } from "../../lib/domain.ts";

/** The same bounded, EXIF-free preview for CLI uploads and historical photos. */
export async function encodeBlurPreview(derivative: Buffer): Promise<string> {
	const tiny = await sharp(derivative)
		.resize({ width: BLUR_IMAGE_SIZE, height: BLUR_IMAGE_SIZE, fit: "inside" })
		.jpeg({ quality: BLUR_IMAGE_QUALITY })
		.toBuffer();
	const preview = parseBlurDataUrl(
		`data:image/jpeg;base64,${tiny.toString("base64")}`,
	);
	if (!preview) throw new Error("Generated placeholder is invalid");
	return preview;
}
