const tasks = [
	"Zdjęcie z kimś, kogo poznajesz dziś pierwszy raz.",
	"Zdjęcie z osobą, której imię zaczyna się na tę samą literę co Twoje.",
	"Zdjęcie zrobione tak, żeby nikt nie zauważył.",
	"Zdjęcie z kimś, kto ma na sobie ten sam kolor co Ty.",
	"Zdjęcie szczegółu, który nam dziś umknie.",
];

export function PhotoChallenge() {
	return (
		<section
			aria-labelledby="challenge-title"
			className="border-t border-ma-ink pt-6 lg:border-l lg:border-t-0 lg:pl-8 lg:pt-0"
		>
			<h2 id="challenge-title" className="ma-label">
				Fotowyzwanie
			</h2>
			<ul className="mt-4 divide-y divide-ma-ash border-y border-ma-ash">
				{tasks.map((task) => (
					<li key={task} className="py-3 text-sm leading-relaxed text-ma-pine">
						{task}
					</li>
				))}
			</ul>
		</section>
	);
}
