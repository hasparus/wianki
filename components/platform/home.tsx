import Link from "next/link";

/** Front door of the owner console on the platform host. */
export function PlatformHome() {
	return (
		<>
			<main className="relative flex w-full grow flex-col px-5 sm:px-10 lg:px-16">
				<div className="mx-auto flex w-full max-w-6xl grow flex-col justify-end pb-[9vh] pt-[22vh] sm:pb-[11vh] sm:pt-[26vh]">
					<h1 className="font-serif text-[clamp(3rem,11vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
						Wianki
					</h1>
					<hr className="ma-rule mt-8" />
					<p className="mt-8 max-w-md text-lg leading-relaxed text-ma-pine">
						Prywatna galeria zdjęć dla gości wesela. Bez kont, bez e-maili, z
						oryginałami w archiwum na lata.
					</p>
					<div className="mt-10 flex flex-wrap gap-4">
						<Link href="/konto/login" className="ma-action">
							Załóż galerię
						</Link>
						<Link href="/cennik" className="ma-action ma-action--ghost">
							Cennik
						</Link>
					</div>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
