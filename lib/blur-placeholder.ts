import { MAX_BLUR_DATA_URL_LENGTH } from "./domain.ts";

const JPEG_DATA_URL_PREFIX = "data:image/jpeg;base64,";

/**
 * The browser builds the blur placeholder next to the derivative, so the
 * server only gets to check that what arrived is a small JPEG data URL and
 * nothing else. Anything that fails is dropped, not rejected: a missing
 * placeholder costs a blur-up, a rejected finalize would cost the photo.
 */
export function parseBlurDataUrl(
	value: string | null | undefined,
): string | null {
	if (
		!value ||
		value.length > MAX_BLUR_DATA_URL_LENGTH ||
		!value.startsWith(JPEG_DATA_URL_PREFIX)
	) {
		return null;
	}
	const encoded = value.slice(JPEG_DATA_URL_PREFIX.length);
	if (!/^[A-Za-z0-9+/]+={0,2}$/.test(encoded) || encoded.length % 4 !== 0) {
		return null;
	}
	const bytes = Buffer.from(encoded, "base64");
	// A JPEG starts with the SOI marker and ends with EOI. Not a full decode,
	// but enough to keep text and other formats out of the column.
	const isJpeg =
		bytes.length >= 4 &&
		bytes[0] === 0xff &&
		bytes[1] === 0xd8 &&
		bytes[2] === 0xff &&
		bytes[bytes.length - 2] === 0xff &&
		bytes[bytes.length - 1] === 0xd9;
	return isJpeg ? value : null;
}
