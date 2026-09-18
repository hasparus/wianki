"use client";

import type { SlideshowBubble } from "@/components/slideshow/use-slideshow-live";

export function BubbleLayer({
	bubbles,
	onDone,
}: {
	bubbles: SlideshowBubble[];
	onDone: (id: string) => void;
}) {
	return (
		<div
			aria-hidden
			className="pointer-events-none absolute inset-0 z-20 overflow-hidden"
		>
			{bubbles.map((bubble) =>
				bubble.kind === "reaction" ? (
					<span
						key={bubble.id}
						onAnimationEnd={() => onDone(bubble.id)}
						className="ma-reaction"
						style={{
							left: `${bubble.leftPercent}%`,
							animationDuration: `${bubble.durationMs}ms`,
							fontSize: `clamp(1.5rem, ${bubble.sizeVmin}vmin, 6rem)`,
						}}
					>
						<span>{bubble.emoji}</span>
					</span>
				) : (
					<span
						key={bubble.id}
						onAnimationEnd={() => onDone(bubble.id)}
						className="ma-comment bg-ma-plaster px-[1em] py-[0.35em] font-serif text-[clamp(1rem,3.4vmin,2.5rem)] text-ma-ink"
						style={{
							top: `${bubble.topPercent}%`,
							animationDuration: `${bubble.durationMs}ms`,
						}}
					>
						{bubble.text}
					</span>
				),
			)}
		</div>
	);
}
