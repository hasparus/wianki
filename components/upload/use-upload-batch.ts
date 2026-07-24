import { useCallback, useRef, useState } from "react";
import { randomSuccessMessage } from "@/components/upload/messages";
import { validateUploadSelection } from "@/components/upload/selection";
import type {
	InitUpload,
	UploadItem,
	UploadJob,
} from "@/components/upload/types";
import {
	completeArchive,
	finalizeUpload,
	initializeUploads,
	prepareDerivative,
	requestArchiveToken,
	uploadArchive,
	uploadDerivative,
} from "@/components/upload/upload-client";
import { runWithConcurrency } from "@/components/upload/upload-queue";

const ORIGINAL_UPLOAD_CONCURRENCY = 2;

export function useUploadBatch(onComplete: () => void) {
	const inputRef = useRef<HTMLInputElement>(null);
	const [items, setItems] = useState<UploadItem[]>([]);
	const [consent, setConsent] = useState(false);
	const [busy, setBusy] = useState(false);
	const [summary, setSummary] = useState("");

	const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
		setItems((current) =>
			current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
		);
	}, []);

	const chooseFiles = useCallback((files: FileList | null) => {
		setSummary("");
		const selection = validateUploadSelection(Array.from(files ?? []));
		if (!selection.valid) {
			setSummary(selection.error);
			return;
		}
		setItems(
			selection.files.map((file) => ({
				id: crypto.randomUUID(),
				file,
				phase: "queued",
				message: "",
			})),
		);
	}, []);

	const processFreshUpload = useCallback(
		async (item: UploadItem, init: InitUpload) => {
			try {
				updateItem(item.id, {
					phase: "compressing",
					message: "",
					photoId: init.photoId,
				});
				const { derivative, width, height } = await prepareDerivative(
					item.file,
				);
				updateItem(item.id, { phase: "uploading" });
				const [hot, archive] = await Promise.all([
					uploadDerivative(init, derivative),
					uploadArchive(init.photoId, item.file, init.archiveToken),
				]);
				updateItem(item.id, { phase: "moderating" });
				const result = await finalizeUpload(init.photoId, {
					archiveReceipt: archive.receipt,
					archiveError: archive.error,
					derivativeSize: derivative.size,
					derivativeType: derivative.type,
					width,
					height,
				});
				if (hot.error) throw hot.error;
				if (result.warning) {
					updateItem(item.id, {
						phase: "archive_failed",
						message:
							"Kopia galeryjna dotarła. Kliknij ponownie, aby dosłać oryginał.",
					});
					return false;
				}
				updateItem(item.id, {
					phase: "done",
					message:
						result.moderationStatus === "approved"
							? "Zdjęcie jest gotowe do pokazania."
							: "Zdjęcie czeka na naszą kontrolę.",
				});
				return true;
			} catch (error) {
				updateItem(item.id, {
					phase: "failed",
					message:
						error instanceof Error ? error.message : "Nie udało się wysłać.",
				});
				return false;
			}
		},
		[updateItem],
	);

	const retryArchive = useCallback(
		async (item: UploadItem) => {
			if (!item.photoId) return false;
			try {
				updateItem(item.id, {
					phase: "uploading",
					message: "Ponawiamy wysyłkę oryginału.",
				});
				const token = await requestArchiveToken(item.photoId);
				if (token.alreadyComplete) {
					updateItem(item.id, {
						phase: "done",
						message: "Oryginał jest już w archiwum.",
					});
					return true;
				}
				const archive = await uploadArchive(
					item.photoId,
					item.file,
					token.archiveToken,
					true,
				);
				if (!archive.receipt) {
					throw new Error(archive.error ?? "Drive nie przyjął oryginału.");
				}
				await completeArchive(item.photoId, archive.receipt);
				updateItem(item.id, {
					phase: "done",
					message: "Oryginał bezpiecznie dotarł.",
				});
				return true;
			} catch (error) {
				updateItem(item.id, {
					phase: "archive_failed",
					message:
						error instanceof Error ? error.message : "Nie udało się ponowić.",
				});
				return false;
			}
		},
		[updateItem],
	);

	const upload = useCallback(async () => {
		if (!consent || !items.length || busy) return;
		setBusy(true);
		setSummary("");
		try {
			const freshItems = items.filter(
				(item) => item.phase === "queued" || item.phase === "failed",
			);
			const retryItems = items.filter(
				(item) => item.phase === "archive_failed",
			);
			const initializations = freshItems.length
				? await initializeUploads(freshItems.map((item) => item.file))
				: [];
			const jobs: UploadJob[] = [
				...freshItems.map((item, index) => ({
					kind: "fresh" as const,
					item,
					init: initializations[index],
				})),
				...retryItems.map((item) => ({ kind: "archive_retry" as const, item })),
			];
			const results = await runWithConcurrency(
				jobs,
				ORIGINAL_UPLOAD_CONCURRENCY,
				(job) =>
					job.kind === "fresh"
						? processFreshUpload(job.item, job.init)
						: retryArchive(job.item),
			);
			const succeeded = results.filter(Boolean).length;
			if (results.length && succeeded === results.length) {
				setSummary(randomSuccessMessage());
				onComplete();
			} else {
				setSummary(
					`Udało się ${succeeded} z ${results.length} operacji. Sprawdź błędy poniżej.`,
				);
			}
		} catch (error) {
			setSummary(
				error instanceof Error ? error.message : "Nie udało się wysłać.",
			);
		} finally {
			setBusy(false);
		}
	}, [busy, consent, items, onComplete, processFreshUpload, retryArchive]);

	return {
		inputRef,
		items,
		consent,
		busy,
		summary,
		chooseFiles,
		setConsent,
		upload,
	};
}
