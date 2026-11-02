import Link from "next/link";

export default function NotFound() {
	return (
		<>
			<main className="relative flex w-full grow flex-col px-5 sm:px-10 lg:px-16">
				<div className="mx-auto flex w-full max-w-6xl grow flex-col justify-end pb-[9vh] pt-[22vh]">
					<p className="ma-label">404</p>
					<h1 className="mt-4 font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
						Nie ma takiej strony.
					</h1>
					<hr className="ma-rule mt-8" />
					<p className="mt-8 max-w-sm text-lg leading-relaxed text-ma-pine">
						Sprawdź adres z zaproszenia albo zeskanuj kod QR jeszcze raz.
					</p>
					<Link href="/" className="ma-action mt-10 self-start">
						Wróć
					</Link>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
