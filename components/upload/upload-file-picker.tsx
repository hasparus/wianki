import type { RefObject } from "react";

export function UploadFilePicker({
	inputRef,
	busy,
	onSelect,
}: {
	inputRef: RefObject<HTMLInputElement | null>;
	busy: boolean;
	onSelect: (files: FileList | null) => void;
}) {
	return (
		<>
			<input
				ref={inputRef}
				type="file"
				accept="image/jpeg,image/png,image/webp,image/heic,image/heif"
				multiple
				onChange={(event) => onSelect(event.target.files)}
				className="sr-only"
			/>
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				disabled={busy}
				className="mt-5 min-h-12 rounded-full border-2 border-wedding-green px-6 font-bold hover:bg-wedding-rose/40 disabled:opacity-60"
			>
				Dodaj zdjęcia
			</button>
		</>
	);
}
