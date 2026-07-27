"use client";

import { UploadFilePicker } from "@/components/upload/upload-file-picker";
import { UploadItemList } from "@/components/upload/upload-item-list";
import { UploadSubmitControls } from "@/components/upload/upload-submit-controls";
import { UploadedPhotos } from "@/components/upload/uploaded-photos";
import { useUploadBatch } from "@/components/upload/use-upload-batch";

export function UploadPanel({ onComplete }: { onComplete: () => void }) {
	const { inputRef, items, busy, summary, chooseFiles, upload } =
		useUploadBatch(onComplete);
	const deliveredItems = items.filter((item) => item.phase === "done");
	const pendingItems = items.filter((item) => item.phase !== "done");

	return (
		<section
			aria-labelledby="upload-title"
			className="rounded-[2rem] border border-wedding-rose bg-wedding-cream p-5 shadow-lg shadow-wedding-rose/15 sm:p-7"
		>
			<h2 id="upload-title" className="font-serif text-3xl font-bold">
				Dodaj swoje zdjęcia
			</h2>
			<p className="mt-2 leading-7">
				Jednorazowo wybierz maksymalnie 10 zdjęć. Folder do dysku ze zdjęciami
				zostanie udostępniony po weselu.
			</p>
			<UploadFilePicker
				inputRef={inputRef}
				busy={busy}
				label={
					deliveredItems.length ? "Dodaj kolejne zdjęcia" : "Wybierz zdjęcia"
				}
				onSelect={chooseFiles}
			/>
			<UploadItemList items={pendingItems} />
			<UploadSubmitControls
				busy={busy}
				hasItems={pendingItems.some((item) =>
					["queued", "failed", "archive_failed"].includes(item.phase),
				)}
				onUpload={upload}
			/>
			{summary ? (
				<p role="status" className="mt-4 font-bold">
					{summary}
				</p>
			) : null}
			<UploadedPhotos items={deliveredItems} />
		</section>
	);
}
