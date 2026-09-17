import type { RefObject } from "react";

export function UploadFilePicker({
	inputRef,
	busy,
	hasQueue,
	onSelect,
}: {
	inputRef: RefObject<HTMLInputElement | null>;
	busy: boolean;
	hasQueue: boolean;
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
			{/*
			 * The reversed ink marks whatever is next, and only that: picking is the
			 * next thing until something is queued, and then sending is. The well
			 * never shows two filled blocks at once.
			 */}
			<button
				type="button"
				onClick={() => inputRef.current?.click()}
				disabled={busy}
				className={`ma-action mt-7 w-full ${hasQueue ? "ma-action--ghost" : ""}`}
			>
				{hasQueue ? "Dodaj kolejne" : "Wybierz zdjęcia"}
			</button>
		</>
	);
}
