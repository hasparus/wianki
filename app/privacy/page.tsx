import Link from "next/link";
import { ArrowLeftIcon } from "@/components/slideshow/icons";

export default function PrivacyPage() {
	const email = process.env.DELETION_CONTACT_EMAIL ?? "adres pary młodej";
	return (
		<>
			<main className="relative mx-auto w-full max-w-6xl grow px-5 py-16 sm:px-10 sm:py-24">
				<article>
					<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
						Co się dzieje ze zdjęciami
					</h1>
					<hr className="ma-rule mt-8" />
					<div className="mt-12 grid gap-10 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-10">
						<h2 className="ma-label sm:pt-1">Gdzie trafiają</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Zdjęcia są przeznaczone wyłącznie dla naszych gości. Pomniejszone
							kopie przechowujemy prywatnie w Supabase, a oryginały w prywatnym
							archiwum Cloudflare R2.
						</p>

						<h2 className="ma-label sm:pt-1">Kto je widzi</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Zdjęcia trafiają do galerii od razu, bez automatycznego
							sprawdzania treści. Możemy ukryć każde zdjęcie.
						</p>

						<h2 className="ma-label sm:pt-1">Czego nie zapisujemy</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Z kopii galeryjnej usuwamy metadane EXIF. Oryginał zachowuje
							metadane aparatu. Nie przypisujemy zdjęć do imienia, e-maila ani
							adresu IP.
						</p>

						<h2 className="ma-label sm:pt-1">Jak długo</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Trzymamy zdjęcia, dopóki sami ich nie usuniemy. Jeżeli chcesz
							usunąć konkretne zdjęcie, napisz na:{" "}
							<strong className="font-normal underline decoration-ma-ash-deep">
								{email}
							</strong>
							.
						</p>
					</div>
					<Link href="/" className="ma-action ma-action--ghost mt-16">
						<ArrowLeftIcon />
						Wróć do galerii
					</Link>
				</article>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
