import { type CSSProperties, useEffect } from "react";

const FIREWORK_SPARKS = Array.from({ length: 12 }, (_, index) => ({
	key: `spark-${index}`,
	index,
}));
const FIREWORKS = [
	{ className: "celebration-firework--left", delay: "0ms" },
	{ className: "celebration-firework--right", delay: "360ms" },
	{ className: "celebration-firework--top", delay: "720ms" },
] as const;

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
		<div className="celebration-splash" aria-hidden="true">
			{FIREWORKS.map((firework) => (
				<div
					className={`celebration-firework ${firework.className}`}
					style={
						{
							"--firework-delay": firework.delay,
						} as CSSProperties
					}
					key={firework.className}
				>
					{FIREWORK_SPARKS.map((spark) => (
						<span
							className="celebration-spark"
							style={
								{
									"--spark-index": spark.index,
								} as CSSProperties
							}
							key={spark.key}
						/>
					))}
				</div>
			))}

			<div className="celebration-card">
				<span className="celebration-card__icon">♥</span>
				<p className="font-serif text-2xl font-bold leading-tight sm:text-3xl">
					{message}
				</p>
			</div>
		</div>
	);
}
