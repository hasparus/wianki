import {
	type ArchiveBackend,
	type ArchivedObject,
	sanitizeObjectName,
	type UploadClaims,
} from "./backend";
import { badRequest, upstreamFailed } from "./claims";

/**
 * Object keys stay human-readable so an operator can browse the bucket, and
 * every wedding sits under its own `sites/<siteId>/originals/` tree, so an
 * export or a deletion of one site is a prefix operation. The
 * `<photoId>__` segment keeps reconciliation a single deterministic prefix
 * listing instead of a metadata search.
 */
export function siteArchivePrefix(siteId: string) {
	return `sites/${siteId}/originals/`;
}

export function archiveKeyPrefix(siteId: string, photoId: string) {
	return `${siteArchivePrefix(siteId)}${photoId}__`;
}

export function buildArchiveKey(
	siteId: string,
	photoId: string,
	filename: string,
) {
	return `${archiveKeyPrefix(siteId, photoId)}${sanitizeObjectName(filename)}`;
}

export function r2Backend(bucket: R2Bucket): ArchiveBackend {
	return {
		async upload(
			body: ReadableStream,
			claims: UploadClaims,
		): Promise<ArchivedObject> {
			const key = buildArchiveKey(
				claims.siteId,
				claims.photoId,
				claims.filename,
			);
			const object = await bucket.put(key, body, {
				httpMetadata: {
					contentType: claims.contentType,
					contentDisposition: `attachment; filename="${sanitizeObjectName(claims.filename)}"`,
				},
				customMetadata: { photoId: claims.photoId, siteId: claims.siteId },
			});
			if (!object) throw upstreamFailed("Archiwum nie przyjęło oryginału.");
			if (object.size !== claims.size) {
				await bucket.delete(key);
				throw badRequest("Zapisany rozmiar nie zgadza się z tokenem.");
			}
			return { key, size: object.size };
		},

		async find(siteId: string, photoId: string) {
			const listed = await bucket.list({
				prefix: archiveKeyPrefix(siteId, photoId),
				limit: 1,
			});
			const object = listed.objects[0];
			return object ? { key: object.key, size: object.size } : null;
		},

		async remove(siteId: string, photoId: string, key: string) {
			if (!key.startsWith(archiveKeyPrefix(siteId, photoId))) {
				throw badRequest("Klucz nie należy do tego zdjęcia.");
			}
			await bucket.delete(key);
		},
	};
}
