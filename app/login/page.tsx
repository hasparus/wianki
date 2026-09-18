import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
	return (
		<>
			{/* The alcove rises from its base: the void sits above the arrangement. */}
			<main className="relative mx-auto flex w-full max-w-6xl grow flex-col justify-end px-5 pb-[9vh] pt-[22vh] sm:px-10 sm:pb-[11vh] sm:pt-[26vh]">
				<div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-24">
					<div>
						<h1 className="font-serif text-[clamp(3rem,11vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
							Rosia <span className="text-ma-pine">&amp;</span> Piotrek
						</h1>
						<hr className="ma-rule mt-8" />
						<p className="mt-8 max-w-sm text-lg leading-relaxed text-ma-pine">
							Zeskanuj kod QR albo wpisz hasło z zaproszenia.
						</p>
					</div>
					<div>
						<LoginForm />
						<Link
							href="/privacy"
							className="ma-label mt-8 inline-block underline decoration-ma-ash-deep hover:text-ma-ink"
						>
							Informacja o prywatności
						</Link>
					</div>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
