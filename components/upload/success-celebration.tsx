import { useEffect } from "react";

/**
 * Delivery. The old splash threw sparks across a full-screen overlay; this one
 * lands in the well the batch was sent from — a struck rule and the couple's
 * line — so placement stays the only moment that takes the screen.
 */
export function SuccessCelebration({
	message,
	onFinished,
}: {
	message: string;
	onFinished: () => void;
}) {
	useEffect(() => {
		const timeout = window.setTimeout(onFinished, 4400);
		return () => window.clearTimeout(timeout);
	}, [onFinished]);

	return (
		<p className="ma-delivery mt-8 font-serif text-2xl leading-tight text-balance sm:text-3xl">
			{message}
		</p>
	);
}
