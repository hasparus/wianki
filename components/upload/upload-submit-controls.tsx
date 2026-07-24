import Link from "next/link";

export function UploadSubmitControls({
	consent,
	busy,
	hasItems,
	onConsentChange,
	onUpload,
}: {
	consent: boolean;
	busy: boolean;
	hasItems: boolean;
	onConsentChange: (consent: boolean) => void;
	onUpload: () => void;
}) {
	return (
		<>
			<label className="mt-5 flex items-start gap-3 text-sm leading-6">
				<input
					type="checkbox"
					checked={consent}
					onChange={(event) => onConsentChange(event.target.checked)}
					className="mt-1 size-5 accent-wedding-green"
				/>
				<span>
					Zgadzam się na przechowanie i sprawdzenie zdjęć zgodnie z{" "}
					<Link href="/privacy" className="font-bold underline">
						informacją o prywatności
					</Link>
					.
				</span>
			</label>
			<button
				type="button"
				onClick={onUpload}
				disabled={!consent || !hasItems || busy}
				className="mt-5 min-h-12 w-full rounded-full bg-wedding-green px-6 font-bold text-wedding-rose hover:bg-wedding-green-soft disabled:cursor-not-allowed disabled:bg-wedding-disabled disabled:text-white"
			>
				{busy ? "Wysyłamy zdjęcia…" : "Wyślij zdjęcia"}
			</button>
		</>
	);
}
