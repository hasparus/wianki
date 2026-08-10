import {
	type ArchiveBackend,
	type ArchivedObject,
	sanitizeObjectName,
	type UploadClaims,
} from "./backend";

const keyPrefix = "originals/";

/**
 * Object keys stay human-readable so the couple can browse the bucket, while
 * the `originals/<photoId>__` prefix keeps reconciliation a single
 * deterministic prefix listing instead of a metadata search.
 */
export function archiveKeyPrefix(photoId: string) {
	return `${keyPrefix}${photoId}__`;
}

export function buildArchiveKey(photoId: string, filename: string) {
	return `${archiveKeyPrefix(photoId)}${sanitizeObjectName(filename)}`;
}

export function r2Backend(bucket: R2Bucket): ArchiveBackend {
	return {
		async upload(
			body: ReadableStream,
			claims: UploadClaims,
		): Promise<ArchivedObject> {
			const key = buildArchiveKey(claims.photoId, claims.filename);
			const object = await bucket.put(key, body, {
				httpMetadata: {
					contentType: claims.contentType,
					contentDisposition: `attachment; filename="${sanitizeObjectName(claims.filename)}"`,
				},
				customMetadata: { photoId: claims.photoId },
			});
			if (!object) throw new Error("Archiwum nie przyjęło oryginału.");
			if (object.size !== claims.size) {
				await bucket.delete(key);
				throw new Error("Zapisany rozmiar nie zgadza się z tokenem.");
			}
			return { key, size: object.size };
		},

		async find(photoId: string) {
			const listed = await bucket.list({
				prefix: archiveKeyPrefix(photoId),
				limit: 1,
			});
			const object = listed.objects[0];
			return object ? { key: object.key, size: object.size } : null;
		},

		async remove(photoId: string, key: string) {
			if (!key.startsWith(archiveKeyPrefix(photoId))) {
				throw new Error("Klucz nie należy do tego zdjęcia.");
			}
			await bucket.delete(key);
		},
	};
}
