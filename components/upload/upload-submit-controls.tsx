import Link from "next/link";

export function UploadSubmitControls({
	busy,
	busyLabel,
	sendable,
	onUpload,
}: {
	busy: boolean;
	busyLabel: string;
	sendable: boolean;
	onUpload: () => void;
}) {
	return (
		<>
			{sendable || busy ? (
				<button
					type="button"
					onClick={onUpload}
					disabled={!sendable || busy}
					className="ma-action mt-8 w-full"
				>
					{busy ? busyLabel : "Wyślij zdjęcia"}
				</button>
			) : null}
			<p className="mt-6 text-sm leading-relaxed text-ma-pine">
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
