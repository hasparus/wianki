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
						className="slideshow-reaction"
						style={{
							left: `${bubble.leftPercent}%`,
							animationDuration: `${bubble.durationMs}ms`,
							fontSize: `${bubble.sizeRem}rem`,
						}}
					>
						<span>{bubble.emoji}</span>
					</span>
				) : (
					<span
						key={bubble.id}
						onAnimationEnd={() => onDone(bubble.id)}
						className="slideshow-comment rounded-full bg-wedding-ivory/95 px-4 py-2 font-serif text-base font-semibold text-wedding-green shadow-lg sm:text-lg"
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
