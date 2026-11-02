import type { R2ObjectBody } from "@cloudflare/workers-types";
import { bindings } from "@/lib/cloudflare";
import { MAX_DERIVATIVE_BYTES } from "@/lib/domain";

/**
 * EXIF-free derivatives live in the private GALLERY bucket under a per-site
 * prefix. Nothing here is public: the browser reads a derivative through
 * `/api/photos/:id/image`, which checks the guest cookie first, and writes
 * one through `/api/uploads/:id/derivative`, which checks ownership.
 */
export function derivativeKey(siteId: string, storagePath: string) {
	return `sites/${siteId}/${storagePath}`;
}

export async function putDerivative(
	key: string,
	body: ArrayBuffer,
	contentType: string,
) {
	if (body.byteLength === 0 || body.byteLength > MAX_DERIVATIVE_BYTES) {
		throw new Error("Kopia galeryjna ma nieprawidłowy rozmiar.");
	}
	await bindings().GALLERY.put(key, body, {
		httpMetadata: { contentType, cacheControl: "private, max-age=3600" },
	});
}

export async function getDerivative(key: string): Promise<R2ObjectBody | null> {
	return bindings().GALLERY.get(key);
}

export async function derivativeBlob(key: string): Promise<Blob | null> {
	const object = await getDerivative(key);
	if (!object) return null;
	const type = object.httpMetadata?.contentType ?? "image/jpeg";
	return new Blob([await object.arrayBuffer()], { type });
}

export async function deleteDerivative(key: string) {
	await bindings().GALLERY.delete(key);
}

/** Where the gallery UI fetches a derivative from; the handler authorizes. */
export function derivativeUrl(photoId: string) {
	return `/api/photos/${photoId}/image`;
}
