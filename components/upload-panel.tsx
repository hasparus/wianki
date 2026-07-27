"use client";

import { UploadFilePicker } from "@/components/upload/upload-file-picker";
import { UploadItemList } from "@/components/upload/upload-item-list";
import { UploadSubmitControls } from "@/components/upload/upload-submit-controls";
import { useUploadBatch } from "@/components/upload/use-upload-batch";

export function UploadPanel({ onComplete }: { onComplete: () => void }) {
	const {
		inputRef,
		items,
		consent,
		busy,
		summary,
		chooseFiles,
		setConsent,
		upload,
	} = useUploadBatch(onComplete);

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
				onSelect={chooseFiles}
			/>
			<UploadItemList items={items} />
			<UploadSubmitControls
				consent={consent}
				busy={busy}
				hasItems={items.some((item) =>
					["queued", "failed", "archive_failed"].includes(item.phase),
				)}
				onConsentChange={setConsent}
				onUpload={upload}
			/>
			{summary ? (
				<p role="status" className="mt-4 font-bold">
					{summary}
				</p>
			) : null}
		</section>
	);
}
