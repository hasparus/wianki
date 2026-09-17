"use client";

import { SuccessCelebration } from "@/components/upload/success-celebration";
import { UploadFilePicker } from "@/components/upload/upload-file-picker";
import { UploadItemList } from "@/components/upload/upload-item-list";
import { UploadSubmitControls } from "@/components/upload/upload-submit-controls";
import { UploadedPhotos } from "@/components/upload/uploaded-photos";
import { useUploadBatch } from "@/components/upload/use-upload-batch";

export function UploadPanel({ onComplete }: { onComplete: () => void }) {
	const {
		inputRef,
		items,
		activeBatchIds,
		busy,
		summary,
		celebrationMessage,
		chooseFiles,
		clearCelebration,
		upload,
	} = useUploadBatch(onComplete);
	// Items keep their place in the list while a batch is in flight and move to
	// the delivered grid together when it finishes, so the layout changes once
	// per batch instead of once per photo.
	const activeIds = new Set(activeBatchIds);
	const deliveredItems = items.filter(
		(item) => item.phase === "done" && !activeIds.has(item.id),
	);
	const pendingItems = items.filter(
		(item) => item.phase !== "done" || activeIds.has(item.id),
	);
	const finishedInBatch = items.filter(
		(item) =>
			activeIds.has(item.id) &&
			item.phase !== "compressing" &&
			item.phase !== "uploading" &&
			item.phase !== "queued",
	).length;

	return (
		<>
			<section
				id="dodaj"
				aria-labelledby="upload-title"
				className="scroll-mt-8"
			>
				<h2
					id="upload-title"
					className="font-serif text-[clamp(2.5rem,7vw,4.5rem)] leading-[0.95]"
				>
					Dodaj swoje zdjęcia
				</h2>
				<hr className="ma-rule mt-5" />
				<p className="mt-6 max-w-lg text-ma-pine">
					Możesz wysłać do 10 zdjęć naraz. Po weselu udostępnimy wszystkim
					folder z oryginałami.
				</p>
				<UploadFilePicker
					inputRef={inputRef}
					busy={busy}
					onSelect={chooseFiles}
				/>
				<UploadItemList items={pendingItems} />
				<UploadSubmitControls
					busy={busy}
					busyLabel={`Wysyłamy… (${finishedInBatch} z ${activeBatchIds.length})`}
					hasItems={pendingItems.some((item) =>
						["queued", "failed", "archive_failed"].includes(item.phase),
					)}
					onUpload={upload}
				/>
				<p role="status" className="mt-5 min-h-6 text-sm font-medium">
					{summary}
				</p>
				<UploadedPhotos items={deliveredItems} />
			</section>

			{celebrationMessage ? (
				<SuccessCelebration
					message={celebrationMessage}
					onFinished={clearCelebration}
				/>
			) : null}
		</>
	);
}
