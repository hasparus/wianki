import Link from "next/link";
import { ArrowLeftIcon } from "@/components/slideshow/icons";
import { currentSite } from "@/lib/sites";

export default async function PrivacyPage() {
	const site = await currentSite();
	const email = site?.deletion_contact_email ?? "adres pary młodej";
	const moderated = site?.moderationEnabled ?? false;
	return (
		<>
			<main className="relative w-full grow px-5 sm:px-10 lg:px-16">
				<article className="mx-auto w-full max-w-6xl py-16 sm:py-24">
					<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
						Co się dzieje ze zdjęciami
					</h1>
					<hr className="ma-rule mt-8" />
					<div className="mt-12 grid gap-10 sm:grid-cols-[10rem_minmax(0,1fr)] sm:gap-x-10">
						<h2 className="ma-label sm:pt-1">Gdzie trafiają</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Zdjęcia są przeznaczone wyłącznie dla gości. Pomniejszone kopie i
							oryginały przechowujemy w prywatnych zasobnikach Cloudflare R2 w
							Unii Europejskiej. Nic nie jest publiczne.
						</p>

						<h2 className="ma-label sm:pt-1">Kto je widzi</h2>
						<p className="max-w-[65ch] leading-relaxed">
							{moderated
								? "Każde zdjęcie przechodzi automatyczne sprawdzenie treści (Google Vision SafeSearch) i dopiero potem trafia do galerii. Para młoda może ukryć każde zdjęcie."
								: "Zdjęcia trafiają do galerii od razu, bez automatycznego sprawdzania treści. Para młoda może ukryć każde zdjęcie."}
						</p>

						<h2 className="ma-label sm:pt-1">Czego nie zapisujemy</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Z kopii galeryjnej usuwamy metadane EXIF. Oryginał zachowuje
							metadane aparatu. Nie przypisujemy zdjęć do imienia, e-maila ani
							adresu IP.
						</p>

						<h2 className="ma-label sm:pt-1">Jak długo</h2>
						<p className="max-w-[65ch] leading-relaxed">
							Zdjęcia zostają, dopóki para młoda ich nie usunie. Jeżeli chcesz
							usunąć konkretne zdjęcie, napisz na:{" "}
							<strong className="font-normal underline decoration-ma-ash-deep">
								{email}
							</strong>
							.
						</p>
					</div>
					<Link href="/" className="ma-action ma-action--ghost mt-16">
						<ArrowLeftIcon />
						{site ? "Wróć do galerii" : "Wróć"}
					</Link>
				</article>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
