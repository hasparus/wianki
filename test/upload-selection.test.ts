import { describe, expect, it } from "vitest";
import { MAX_ORIGINAL_BYTES } from "@/lib/domain";
import { validateUploadSelection } from "@/components/upload/selection";

const validPhoto = {
	name: "wesele.jpg",
	type: "image/jpeg",
	size: 1024,
};

describe("upload selection", () => {
	it("accepts up to ten supported photos within the size limit", () => {
		const result = validateUploadSelection(
			Array.from({ length: 10 }, (_, index) => ({
				...validPhoto,
				name: `wesele-${index}.jpg`,
			})),
		);

		expect(result).toEqual({
			valid: true,
			files: Array.from({ length: 10 }, (_, index) => ({
				...validPhoto,
				name: `wesele-${index}.jpg`,
			})),
		});
	});

	it("rejects batches above the documented limit before uploading", () => {
		const result = validateUploadSelection(
			Array.from({ length: 11 }, () => validPhoto),
		);

		expect(result).toEqual({
			valid: false,
			error: "W jednym podejściu możesz wybrać maksymalnie 10 zdjęć.",
		});
	});

	it("rejects unsupported and oversized originals", () => {
		expect(
			validateUploadSelection([{ ...validPhoto, type: "image/gif" }]),
		).toEqual({
			valid: false,
			error: "wesele.jpg: obsługujemy zdjęcia JPEG, PNG, WebP i HEIC do 25 MB.",
		});
		expect(
			validateUploadSelection([
				{ ...validPhoto, size: MAX_ORIGINAL_BYTES + 1 },
			]),
		).toEqual({
			valid: false,
			error: "wesele.jpg: obsługujemy zdjęcia JPEG, PNG, WebP i HEIC do 25 MB.",
		});
	});
});
