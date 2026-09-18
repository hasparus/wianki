"use client";

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
		chooseFiles,
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
	// The submit line only exists once there is something to send: an empty well
	// is a composed invitation, not a disabled bar.
	const sendable = pendingItems.some((item) =>
		["queued", "failed", "archive_failed"].includes(item.phase),
	);

	return (
		<section
			id="dodaj"
			aria-labelledby="upload-title"
			className="ma-plane scroll-mt-8 p-5 sm:p-8 lg:p-10"
		>
			<h2
				id="upload-title"
				className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[0.95]"
			>
				Dodaj swoje zdjęcia
			</h2>
			<hr className="ma-rule mt-5" />
			<p className="mt-5 text-ma-pine">
				Do 10 zdjęć naraz. Po weselu udostępnimy folder z oryginałami.
			</p>
			<UploadFilePicker
				inputRef={inputRef}
				busy={busy}
				hasQueue={pendingItems.length > 0}
				onSelect={chooseFiles}
			/>
			<UploadItemList items={pendingItems} />
			<UploadSubmitControls
				busy={busy}
				busyLabel={`Wysyłamy… (${finishedInBatch} z ${activeBatchIds.length})`}
				sendable={sendable}
				onUpload={upload}
			/>
			{summary ? (
				<p role="status" className="mt-5 text-sm font-medium">
					{summary}
				</p>
			) : null}
			<UploadedPhotos items={deliveredItems} />
		</section>
	);
}
