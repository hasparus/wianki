const tasks = [
	"Zdjęcie z kimś, kogo poznajesz dziś pierwszy raz.",
	"Zdjęcie z osobą, której imię zaczyna się na tę samą literę co Twoje.",
	"Zdjęcie zrobione tak, żeby nikt nie zauważył.",
	"Zdjęcie z kimś, kto ma na sobie ten sam kolor co Ty.",
	"Zdjęcie szczegółu, który nam dziś umknie.",
];

export function PhotoChallenge() {
	return (
		<section className="rounded-[2rem] border border-wedding-rose bg-wedding-cream p-6 shadow-lg shadow-wedding-rose/15 sm:p-8">
			<h2 className="font-serif text-2xl font-bold">Zadania fotograficzne</h2>
			<p className="mt-2 leading-7">
				Pięć rzeczy do upolowania między jednym tańcem a drugim. Nie musisz
				zaliczyć wszystkich.
			</p>
			<ol className="mt-4 grid gap-3">
				{tasks.map((task, index) => (
					<li key={task} className="flex gap-3 leading-7">
						<span
							aria-hidden
							className="mt-1 grid size-6 shrink-0 place-items-center rounded-full bg-wedding-rose text-sm font-bold"
						>
							{index + 1}
						</span>
						{task}
					</li>
				))}
			</ol>
		</section>
	);
}
