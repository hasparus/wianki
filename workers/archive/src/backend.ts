import type { Claims } from "./claims";

/** `size` must be the size the archive actually stored, never the size asked for. */
export type ArchivedObject = { key: string; size: number };

export type UploadClaims = Extract<Claims, { operation: "upload" }>;

/**
 * Where originals live. The HTTP boundary, capability tokens, receipts and
 * size guard are written once in index.ts; a backend only has to put an
 * original somewhere, find it again, and remove it.
 *
 * `key` is whatever identifies the object to its own backend — an R2 object
 * key or a Drive file id — and is what the app stores as `archive_key`.
 */
export type ArchiveBackend = {
	upload(body: ReadableStream, claims: UploadClaims): Promise<ArchivedObject>;
	find(photoId: string): Promise<ArchivedObject | null>;
	remove(photoId: string, key: string): Promise<void>;
};

/** Keeps a guest's filename usable as an object name without path tricks. */
export function sanitizeObjectName(value: string) {
	return (
		value
			// biome-ignore lint/suspicious/noControlCharactersInRegex: path separators and control characters are exactly what gets replaced here.
			.replace(/[\u0000-\u001f/\\]+/g, "-")
			.slice(0, 180) || "zdjecie"
	);
}
