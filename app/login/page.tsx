import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
	return (
		<>
			<main className="relative mx-auto flex w-full max-w-6xl grow flex-col px-5 pb-[14vh] pt-[18vh] sm:px-10 sm:pt-[22vh]">
				<span className="ma-marginalia">Wejście</span>
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
						<p className="mt-8 text-sm leading-relaxed text-ma-pine">
							Wchodząc do galerii, pamiętaj o naszej{" "}
							<Link
								href="/privacy"
								className="text-ma-ink underline decoration-ma-ash-deep hover:decoration-ma-ink"
							>
								informacji o prywatności
							</Link>
							.
						</p>
					</div>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
