const tasks = [
	"Zdjęcie z kimś, kogo poznajesz dziś pierwszy raz.",
	"Zdjęcie z osobą, której imię zaczyna się na tę samą literę co Twoje.",
	"Zdjęcie zrobione tak, żeby nikt nie zauważył.",
	"Zdjęcie z kimś, kto ma na sobie ten sam kolor co Ty.",
	"Zdjęcie szczegółu, który nam dziś umknie.",
];

export function PhotoChallenge() {
	return (
		<section aria-labelledby="challenge-title">
			<h2 id="challenge-title" className="ma-label">
				Fotowyzwanie
			</h2>
			{/* The hanja numeral ranks the task without competing with it. */}
			<ol className="mt-4 list-[korean-hanja-informal] list-inside marker:text-ma-ash-deep">
				{tasks.map((task) => (
					<li key={task} className="py-3 text-sm leading-relaxed text-ma-ink">
						{task}
					</li>
				))}
			</ol>
		</section>
	);
}
