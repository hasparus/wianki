/**
 * The couple's names as the site's wordmark. An ampersand between two names
 * is set in the quieter tone, the way the original "Rosia & Piotrek" was;
 * any other title is set as typed.
 */
export function Wordmark({
	title,
	className,
}: {
	title: string;
	className?: string;
}) {
	const [head, ...rest] = title.split(/\s+&\s+/);
	return (
		<h1 className={className}>
			{head}
			{rest.map((part) => (
				<span key={part}>
					<span className="text-ma-pine"> &amp; </span>
					{part}
				</span>
			))}
		</h1>
	);
}
