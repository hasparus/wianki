import Link from "next/link";

export function UploadSubmitControls({
	busy,
	busyLabel,
	hasItems,
	onUpload,
}: {
	busy: boolean;
	busyLabel: string;
	hasItems: boolean;
	onUpload: () => void;
}) {
	return (
		<>
			<button
				type="button"
				onClick={onUpload}
				disabled={!hasItems || busy}
				className="ma-action mt-8 w-full"
			>
				{busy ? busyLabel : "Wyślij zdjęcia"}
			</button>
			<p className="mt-4 max-w-lg text-sm leading-relaxed text-ma-pine">
				Wysyłając zdjęcia, zgadzasz się na ich przechowanie i sprawdzenie
				zgodnie z{" "}
				<Link
					href="/privacy"
					className="text-ma-ink underline decoration-ma-ash-deep hover:decoration-ma-ink"
				>
					informacją o prywatności
				</Link>
				.
			</p>
		</>
	);
}
