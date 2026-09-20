import "client-only";

import imageCompression from "browser-image-compression";
import type { FinalizeResult, InitUpload } from "@/components/upload/types";
import {
	BLUR_IMAGE_QUALITY,
	BLUR_IMAGE_SIZE,
	MAX_DERIVATIVE_BYTES,
} from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ArchiveUploadResult = {
	receipt: string | null;
	error: string | null;
};

type GalleryUploadResult = {
	error: Error | null;
};

async function encodeTinyJpeg(
	bitmap: ImageBitmap,
	width: number,
	height: number,
): Promise<Blob> {
	if (typeof OffscreenCanvas !== "undefined") {
		const canvas = new OffscreenCanvas(width, height);
		const context = canvas.getContext("2d");
		if (!context) throw new Error("no 2d context");
		context.drawImage(bitmap, 0, 0, width, height);
		return canvas.convertToBlob({
			type: "image/jpeg",
			quality: BLUR_IMAGE_QUALITY / 100,
		});
	}
	const canvas = document.createElement("canvas");
	canvas.width = width;
	canvas.height = height;
	const context = canvas.getContext("2d");
	if (!context) throw new Error("no 2d context");
	context.drawImage(bitmap, 0, 0, width, height);
	return new Promise((resolve, reject) => {
		canvas.toBlob(
			(blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))),
			"image/jpeg",
			BLUR_IMAGE_QUALITY / 100,
		);
	});
}

/**
 * The blur-up placeholder, made the way next/image makes one for a static
 * import: the long edge shrunk to 8px, JPEG at quality 70, as a data URL.
 * Never fatal — a photo without a blur is still a photo.
 */
export async function makeBlurDataUrl(
	bitmap: ImageBitmap,
): Promise<string | null> {
	try {
		const scale = BLUR_IMAGE_SIZE / Math.max(bitmap.width, bitmap.height);
		const width = Math.max(1, Math.round(bitmap.width * scale));
		const height = Math.max(1, Math.round(bitmap.height * scale));
		const blob = await encodeTinyJpeg(bitmap, width, height);
		const bytes = new Uint8Array(await blob.arrayBuffer());
		let binary = "";
		for (const byte of bytes) binary += String.fromCharCode(byte);
		return `data:image/jpeg;base64,${btoa(binary)}`;
	} catch {
		return null;
	}
}

export async function prepareDerivative(file: File) {
	let derivative: File;
	try {
		derivative = await imageCompression(file, {
			maxSizeMB: 0.4,
			maxWidthOrHeight: 1920,
			useWebWorker: true,
			fileType: "image/jpeg",
			preserveExif: false,
		});
	} catch {
		throw new Error(
			"Nie udało się przygotować zdjęcia. Spróbuj wybrać plik JPEG.",
		);
	}

	if (
		derivative.size <= 0 ||
		derivative.size > MAX_DERIVATIVE_BYTES ||
		derivative.type !== "image/jpeg"
	) {
		throw new Error("Nie udało się przygotować zdjęcia mniejszego niż 500 KB.");
	}

	let bitmap: ImageBitmap;
	try {
		bitmap = await createImageBitmap(derivative);
	} catch {
		throw new Error(
			"Nie udało się odczytać przygotowanego zdjęcia. Spróbuj wybrać plik JPEG.",
		);
	}
	try {
		const dimensions = { width: bitmap.width, height: bitmap.height };
		const blurDataUrl = await makeBlurDataUrl(bitmap);
		return { derivative, ...dimensions, blurDataUrl };
	} finally {
		bitmap.close();
	}
}

function archiveUrl(photoId: string) {
	return `${process.env.NEXT_PUBLIC_ARCHIVE_WORKER_URL ?? ""}/v1/archive/${photoId}`;
}

export async function uploadDerivative(
	init: InitUpload,
	derivative: File | Blob,
): Promise<GalleryUploadResult> {
	try {
		const body = await derivative.arrayBuffer();
		const { error } = await supabaseBrowser()
			.storage.from("gallery")
			.uploadToSignedUrl(init.path, init.uploadToken, body, {
				contentType: "image/jpeg",
				cacheControl: "3600",
			});
		return { error };
	} catch (error) {
		return {
			error:
				error instanceof Error
					? error
					: new Error("Kopia galeryjna nie dotarła."),
		};
	}
}

// XMLHttpRequest instead of fetch: it is the only way to observe upload
// progress for the multi-megabyte original.
export function uploadArchive(
	photoId: string,
	file: File,
	archiveToken: string,
	options: {
		readFailureMessage?: boolean;
		onProgress?: (fraction: number) => void;
	} = {},
): Promise<ArchiveUploadResult> {
	return new Promise((resolve, reject) => {
		const xhr = new XMLHttpRequest();
		xhr.open("PUT", archiveUrl(photoId));
		xhr.setRequestHeader("Authorization", `Bearer ${archiveToken}`);
		xhr.setRequestHeader("Content-Type", file.type);
		xhr.upload.onprogress = (event) => {
			if (event.lengthComputable) {
				options.onProgress?.(event.loaded / event.total);
			}
		};
		xhr.onload = () => {
			try {
				if (xhr.status >= 200 && xhr.status < 300) {
					const body = JSON.parse(xhr.responseText) as { receipt?: string };
					resolve({ receipt: body.receipt ?? null, error: null });
					return;
				}
				const body = options.readFailureMessage
					? (JSON.parse(xhr.responseText) as { error?: string })
					: null;
				resolve({
					receipt: null,
					error: body?.error ?? "Oryginał nie dotarł do archiwum.",
				});
			} catch (error) {
				reject(
					error instanceof Error
						? error
						: new Error("Oryginał nie dotarł do archiwum."),
				);
			}
		};
		xhr.onerror = () => reject(new Error("Oryginał nie dotarł do archiwum."));
		xhr.send(file);
	});
}

export async function finalizeUpload(
	photoId: string,
	data: {
		archiveReceipt: string | null;
		archiveError: string | null;
		derivativeSize: number;
		derivativeType: string;
		width: number;
		height: number;
		blurDataUrl: string | null;
	},
): Promise<FinalizeResult> {
	const response = await fetch(`/api/uploads/${photoId}/finalize`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify(data),
	});
	const body = (await response.json()) as FinalizeResult & { error?: string };
	if (!response.ok)
		throw new Error(body.error ?? "Finalizacja nie powiodła się.");
	return body;
}

export async function initializeUploads(files: File[]): Promise<InitUpload[]> {
	const response = await fetch("/api/uploads/init", {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({
			consent: true,
			files: files.map((file) => ({
				name: file.name,
				type: file.type,
				size: file.size,
			})),
		}),
	});
	const body = (await response.json()) as {
		error?: string;
		uploads?: InitUpload[];
	};
	if (!response.ok || !body.uploads) {
		throw new Error(body.error ?? "Nie udało się rozpocząć.");
	}
	return body.uploads;
}

export async function requestArchiveToken(photoId: string) {
	const response = await fetch(`/api/uploads/${photoId}/archive`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "token" }),
	});
	const body = (await response.json()) as {
		archiveToken?: string;
		alreadyComplete?: boolean;
		error?: string;
	};
	if (body.alreadyComplete) return { alreadyComplete: true } as const;
	if (!response.ok || !body.archiveToken) {
		throw new Error(body.error ?? "Nie udało się odnowić wysyłki.");
	}
	return { archiveToken: body.archiveToken, alreadyComplete: false } as const;
}

export async function completeArchive(photoId: string, receipt: string) {
	const response = await fetch(`/api/uploads/${photoId}/archive`, {
		method: "POST",
		headers: { "Content-Type": "application/json" },
		body: JSON.stringify({ action: "complete", receipt }),
	});
	const body = (await response.json()) as { error?: string };
	if (!response.ok) {
		throw new Error(body.error ?? "Nie zapisano potwierdzenia.");
	}
}
