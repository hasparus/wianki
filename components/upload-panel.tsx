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
				aria-labelledby="upload-title"
				className="rounded-[2rem] border border-wedding-rose bg-wedding-cream p-5 shadow-lg shadow-wedding-rose/15 sm:p-7"
			>
				<h2 id="upload-title" className="font-serif text-3xl font-bold">
					Dodaj swoje zdjęcia
				</h2>
				<p className="mt-2 leading-7">
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
					busyLabel={`Wysyłamy zdjęcia… (${finishedInBatch} z ${activeBatchIds.length})`}
					hasItems={pendingItems.some((item) =>
						["queued", "failed", "archive_failed"].includes(item.phase),
					)}
					onUpload={upload}
				/>
				<p role="status" className="mt-4 min-h-12 font-bold">
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
