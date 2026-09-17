import type { SVGProps } from "react";

/**
 * The slideshow's drawn icon set: 24px grid, 2px round stroke, inherits
 * currentColor. Reaction emoji are content, not icons — they stay emoji.
 */
function Icon({ children, ...props }: SVGProps<SVGSVGElement>) {
	return (
		<svg
			viewBox="0 0 24 24"
			fill="none"
			stroke="currentColor"
			strokeWidth={2}
			strokeLinecap="round"
			strokeLinejoin="round"
			aria-hidden="true"
			className="size-[1.15em] shrink-0"
			{...props}
		>
			{children}
		</svg>
	);
}

export function ChevronLeftIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M14.5 5.5 8 12l6.5 6.5" />
		</Icon>
	);
}

export function ChevronRightIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M9.5 5.5 16 12l-6.5 6.5" />
		</Icon>
	);
}

export function PlayIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path
				d="M8.5 6.2v11.6c0 .8.9 1.3 1.6.9l9-5.8c.6-.4.6-1.4 0-1.8l-9-5.8c-.7-.4-1.6.1-1.6.9Z"
				fill="currentColor"
				stroke="none"
			/>
		</Icon>
	);
}

export function PauseIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M9 6.5v11M15 6.5v11" />
		</Icon>
	);
}

export function EyeIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
			<circle cx="12" cy="12" r="2.6" />
		</Icon>
	);
}

export function ArrowUpIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M12 19V5M5.5 11.5 12 5l6.5 6.5" />
		</Icon>
	);
}

export function ArrowDownIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M12 5v14M5.5 12.5 12 19l6.5-6.5" />
		</Icon>
	);
}

export function XIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			<path d="M6 6l12 12M18 6 6 18" />
		</Icon>
	);
}

export function GripIcon(props: SVGProps<SVGSVGElement>) {
	return (
		<Icon {...props}>
			{[6, 12, 18].flatMap((y) =>
				[9, 15].map((x) => (
					<circle
						key={`${x}-${y}`}
						cx={x}
						cy={y}
						r="1.4"
						fill="currentColor"
						stroke="none"
					/>
				)),
			)}
		</Icon>
	);
}
