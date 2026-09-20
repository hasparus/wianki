import { describe, expect, it } from "vitest";
import { parseBlurDataUrl } from "./blur-placeholder";
import { MAX_BLUR_DATA_URL_LENGTH } from "./domain";

function jpegDataUrl(payload: number[] = [0x00, 0x10, 0x4a, 0x46]) {
	const bytes = Buffer.from([0xff, 0xd8, 0xff, ...payload, 0xff, 0xd9]);
	return `data:image/jpeg;base64,${bytes.toString("base64")}`;
}

describe("blur placeholder parsing", () => {
	it("keeps a small JPEG data URL as it came", () => {
		const value = jpegDataUrl();
		expect(parseBlurDataUrl(value)).toBe(value);
	});

	it("drops anything that is not a JPEG data URL", () => {
		const png =
			"data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==";
		const text = `data:image/jpeg;base64,${Buffer.from("<svg/>").toString("base64")}`;
		expect(parseBlurDataUrl(png)).toBeNull();
		expect(parseBlurDataUrl(text)).toBeNull();
		expect(parseBlurDataUrl("data:image/jpeg;base64,not base64!")).toBeNull();
		expect(parseBlurDataUrl("https://example.com/blur.jpg")).toBeNull();
		expect(parseBlurDataUrl("")).toBeNull();
		expect(parseBlurDataUrl(null)).toBeNull();
		expect(parseBlurDataUrl(undefined)).toBeNull();
	});

	it("drops a placeholder over the length cap", () => {
		const padding = new Array(MAX_BLUR_DATA_URL_LENGTH).fill(0x00);
		const value = jpegDataUrl(padding);
		expect(value.length).toBeGreaterThan(MAX_BLUR_DATA_URL_LENGTH);
		expect(parseBlurDataUrl(value)).toBeNull();
	});
});
