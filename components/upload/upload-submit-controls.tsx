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
				className="mt-5 min-h-12 w-full rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:cursor-not-allowed disabled:bg-wedding-disabled disabled:text-white"
			>
				{busy ? busyLabel : "Wyślij zdjęcia"}
			</button>
			<p className="mt-3 text-sm leading-6">
				Wysyłając zdjęcia, zgadzasz się na ich przechowanie i sprawdzenie
				zgodnie z{" "}
				<Link href="/privacy" className="font-bold underline">
					informacją o prywatności
				</Link>
				.
			</p>
		</>
	);
}
