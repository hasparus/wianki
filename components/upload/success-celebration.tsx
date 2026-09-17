import { useEffect } from "react";

/**
 * Delivery. The old splash threw sparks; this world places one card on the
 * ground and strikes a single rule beneath it, then lets the room go quiet.
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
		<div className="ma-delivery" aria-hidden="true">
			<div className="ma-delivery__card">
				<p className="ma-label">Dostarczone</p>
				<p className="mt-6 font-serif text-3xl leading-tight text-balance sm:text-4xl">
					{message}
				</p>
				<hr className="ma-rule mt-8" />
			</div>
		</div>
	);
}
