import { useCallback, useEffect, useRef, useState } from "react";
import { retainDeliveredItems } from "@/components/upload/items";
import { completedUploadMessages } from "@/components/upload/messages";
import { validateUploadSelection } from "@/components/upload/selection";
import type {
	FinalizeResult,
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
	const [busy, setBusy] = useState(false);
	const [summary, setSummary] = useState("");
	const [activeBatchIds, setActiveBatchIds] = useState<readonly string[]>([]);
	const [celebrationMessage, setCelebrationMessage] = useState("");

	const itemsRef = useRef<UploadItem[]>([]);
	itemsRef.current = items;
	useEffect(
		() => () => {
			for (const item of itemsRef.current) {
				if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
			}
		},
		[],
	);

	const updateItem = useCallback((id: string, patch: Partial<UploadItem>) => {
		setItems((current) =>
			current.map((item) => (item.id === id ? { ...item, ...patch } : item)),
		);
	}, []);

	const chooseFiles = useCallback((files: FileList | null) => {
		setSummary("");
		setCelebrationMessage("");
		const selection = validateUploadSelection(Array.from(files ?? []));
		if (inputRef.current) inputRef.current.value = "";
		if (!selection.valid) {
			setSummary(selection.error);
			return;
		}
		setItems((current) => {
			const { kept, droppedPreviewUrls } = retainDeliveredItems(current);
			for (const url of droppedPreviewUrls) URL.revokeObjectURL(url);
			return [
				...kept,
				...selection.files.map((file) => ({
					id: crypto.randomUUID(),
					file,
					phase: "queued" as const,
					message: "",
					previewUrl: URL.createObjectURL(file),
				})),
			];
		});
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
				updateItem(item.id, { phase: "uploading", progress: 0 });
				const [hot, archive] = await Promise.all([
					uploadDerivative(init, derivative),
					uploadArchive(init.photoId, item.file, init.archiveToken, {
						onProgress: (fraction) =>
							updateItem(item.id, { progress: fraction }),
					}),
				]);
				let result: FinalizeResult;
				try {
					result = await finalizeUpload(init.photoId, {
						archiveReceipt: archive.receipt,
						archiveError: archive.error,
						derivativeSize: derivative.size,
						derivativeType: derivative.type,
						width,
						height,
					});
				} catch (error) {
					throw hot.error ?? error;
				}
				if (hot.error) throw hot.error;
				if (result.warning) {
					updateItem(item.id, {
						phase: "archive_failed",
						message:
							"Zdjęcie jest już na stronie, ale nie doszło na nasz dysk :(. Kliknij „Wyślij zdjęcia”, aby spróbować jeszcze raz.",
					});
					return false;
				}
				updateItem(item.id, {
					phase: "done",
					message: "Zdjęcie dotarło. Za kilka minut będzie w galerii.",
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
					progress: 0,
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
					{
						readFailureMessage: true,
						onProgress: (fraction) =>
							updateItem(item.id, { progress: fraction }),
					},
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
		if (!items.length || busy) return;
		setBusy(true);
		setSummary("");
		setCelebrationMessage("");
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
			setActiveBatchIds(jobs.map((job) => job.item.id));
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
				const messages = completedUploadMessages();
				setSummary(messages.summary);
				setCelebrationMessage(messages.celebration);
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
			setActiveBatchIds([]);
		}
	}, [busy, items, onComplete, processFreshUpload, retryArchive]);

	const clearCelebration = useCallback(() => setCelebrationMessage(""), []);

	return {
		inputRef,
		items,
		activeBatchIds,
		busy,
		summary,
		celebrationMessage,
		chooseFiles,
		clearCelebration,
		upload,
	};
}
