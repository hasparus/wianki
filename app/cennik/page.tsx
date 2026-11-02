import type { Metadata } from "next";
import Link from "next/link";
import { TRIAL_PHOTO_LIMIT } from "@/lib/domain";

export const metadata: Metadata = {
	title: "Cennik — Wianki",
	description:
		"Prywatna galeria ślubna za 49 $ rocznie, z 10 GB oryginałów w cenie.",
};

const included = [
	"Nieograniczona liczba gości: wchodzą kodem QR albo hasłem z zaproszenia.",
	"Pokaz slajdów na żywo z reakcjami gości na sali.",
	"Oryginały w archiwum, bez kompresji, do pobrania po weselu.",
	"Bez kont i bez e-maili gości: żadne zdjęcie nie jest powiązane z osobą.",
	"Moderacja i ukrywanie zdjęć w panelu pary młodej.",
	"Własna domena, jeśli chcecie.",
];

/** Public price list on the platform host. Static copy; no data behind it. */
export default function PricingPage() {
	return (
		<>
			<main className="relative w-full grow px-5 sm:px-10 lg:px-16">
				<div className="mx-auto w-full max-w-6xl py-16 sm:py-24">
					<header className="grid gap-8 lg:grid-cols-12 lg:items-end">
						<div className="lg:col-span-7">
							<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
								Cennik
							</h1>
							<hr className="ma-rule mt-6" />
						</div>
						<p className="leading-relaxed text-ma-pine lg:col-span-4 lg:col-start-9">
							Jedna cena za galerię na rok. Płacicie dopiero wtedy, gdy wersja
							próbna przestaje wystarczać.
						</p>
					</header>

					<section className="mt-16 grid gap-10 border-t border-ma-ash pt-14 lg:grid-cols-12">
						<div className="lg:col-span-5">
							<p className="ma-label">Za galerię</p>
							<p className="ma-numeral mt-3 text-[clamp(3.5rem,12vw,7rem)]">
								49&nbsp;$
							</p>
							<p className="mt-2 text-lg text-ma-pine">rocznie</p>
							<dl className="mt-10 grid gap-6 border-t border-ma-ash pt-8">
								<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
									<dt>Oryginały w cenie</dt>
									<dd className="tabular-nums">10 GB</dd>
								</div>
								<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
									<dt>Każde kolejne 10 GB</dt>
									<dd className="tabular-nums">5 $ rocznie</dd>
								</div>
								<div className="grid grid-cols-[minmax(0,1fr)_auto] gap-4">
									<dt>Wersja próbna</dt>
									<dd className="tabular-nums">do {TRIAL_PHOTO_LIMIT} zdjęć</dd>
								</div>
							</dl>
							<p className="mt-6 text-sm leading-relaxed text-ma-pine">
								Dopłata za archiwum liczy się na koniec roku według tego, ile
								oryginałów galeria wtedy przechowuje. Usunięte zdjęcia nie liczą
								się.
							</p>
						</div>
						<div className="lg:col-span-6 lg:col-start-7">
							<p className="ma-label">W cenie</p>
							<ul className="mt-4 border-t border-ma-ash">
								{included.map((item) => (
									<li
										key={item}
										className="border-b border-ma-ash py-4 leading-relaxed"
									>
										{item}
									</li>
								))}
							</ul>
							<div className="mt-10 flex flex-wrap gap-4">
								<Link href="/konto/login" className="ma-action">
									Załóż galerię
								</Link>
								<Link href="/" className="ma-action ma-action--ghost">
									Strona główna
								</Link>
							</div>
						</div>
					</section>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
