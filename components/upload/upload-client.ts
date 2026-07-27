import "client-only";

import imageCompression from "browser-image-compression";
import type { FinalizeResult, InitUpload } from "@/components/upload/types";
import { MAX_DERIVATIVE_BYTES } from "@/lib/domain";
import { supabaseBrowser } from "@/lib/supabase/browser";

type ArchiveUploadResult = {
	receipt: string | null;
	error: string | null;
};

type GalleryUploadResult = {
	error: Error | null;
};

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

	try {
		const bitmap = await createImageBitmap(derivative);
		const dimensions = { width: bitmap.width, height: bitmap.height };
		bitmap.close();
		return { derivative, ...dimensions };
	} catch {
		throw new Error(
			"Nie udało się odczytać przygotowanego zdjęcia. Spróbuj wybrać plik JPEG.",
		);
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
