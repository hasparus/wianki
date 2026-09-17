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
				className="ma-action ma-action--ghost mt-8 w-full sm:w-auto"
			>
				Wybierz zdjęcia
			</button>
		</>
	);
}
