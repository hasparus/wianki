import "client-only";

import imageCompression from "browser-image-compression";
import { supabaseBrowser } from "@/lib/supabase/browser";
import type { FinalizeResult, InitUpload } from "@/components/upload/types";

type ArchiveUploadResult = {
	receipt: string | null;
	error: string | null;
};

export async function prepareDerivative(file: File) {
	if (file.type === "image/heic" || file.type === "image/heif") {
		try {
			const bitmap = await createImageBitmap(file);
			bitmap.close();
		} catch {
			throw new Error(
				"To urządzenie nie potrafi przygotować pliku HEIC. Wyeksportuj zdjęcie jako JPEG.",
			);
		}
	}
	const derivative = await imageCompression(file, {
		maxSizeMB: 0.488,
		maxWidthOrHeight: 1920,
		useWebWorker: true,
		fileType: "image/webp",
		preserveExif: false,
		initialQuality: 0.86,
	});
	const bitmap = await createImageBitmap(derivative);
	const dimensions = { width: bitmap.width, height: bitmap.height };
	bitmap.close();
	return { derivative, ...dimensions };
}

function archiveUrl(photoId: string) {
	return `${process.env.NEXT_PUBLIC_ARCHIVE_WORKER_URL ?? ""}/v1/archive/${photoId}`;
}

export async function uploadDerivative(
	init: InitUpload,
	derivative: File | Blob,
) {
	return supabaseBrowser()
		.storage.from("gallery")
		.uploadToSignedUrl(init.path, init.uploadToken, derivative, {
			contentType: derivative.type,
			cacheControl: "3600",
		});
}

export async function uploadArchive(
	photoId: string,
	file: File,
	archiveToken: string,
	readFailureMessage = false,
): Promise<ArchiveUploadResult> {
	const response = await fetch(archiveUrl(photoId), {
		method: "PUT",
		headers: {
			Authorization: `Bearer ${archiveToken}`,
			"Content-Type": file.type,
		},
		body: file,
	});
	if (response.ok) {
		const body = (await response.json()) as { receipt?: string };
		return { receipt: body.receipt ?? null, error: null };
	}
	const body = readFailureMessage
		? ((await response.json()) as { error?: string })
		: null;
	return {
		receipt: null,
		error: body?.error ?? "Oryginał nie dotarł do archiwum Drive.",
	};
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
