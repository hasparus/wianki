import {
	acceptedOriginalTypes,
	MAX_BATCH_FILES,
	MAX_ORIGINAL_BYTES,
} from "@/lib/domain";
import type { UploadFileMetadata } from "@/components/upload/types";

type SelectionResult<T> =
	| { valid: true; files: T[] }
	| { valid: false; error: string };

export function validateUploadSelection<T extends UploadFileMetadata>(
	files: readonly T[],
): SelectionResult<T> {
	if (files.length > MAX_BATCH_FILES) {
		return {
			valid: false,
			error: "W jednym podejściu możesz wybrać maksymalnie 10 zdjęć.",
		};
	}
	const invalid = files.find(
		(file) =>
			!acceptedOriginalTypes.includes(
				file.type as (typeof acceptedOriginalTypes)[number],
			) || file.size > MAX_ORIGINAL_BYTES,
	);
	if (invalid) {
		return {
			valid: false,
			error: `${invalid.name}: obsługujemy zdjęcia JPEG, PNG, WebP i HEIC do 25 MB.`,
		};
	}
	return { valid: true, files: [...files] };
}
