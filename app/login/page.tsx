import Link from "next/link";
import { LoginForm } from "./login-form";

export default function LoginPage() {
	return (
		<main className="mx-auto flex min-h-screen w-full max-w-lg items-center px-5 py-12">
			<section className="w-full rounded-[2rem] border border-wedding-rose bg-wedding-cream p-7 shadow-xl shadow-wedding-rose/20 sm:p-10">
				<p className="text-sm font-bold uppercase tracking-[0.25em]">
					Paweł & Magdicia
				</p>
				<h1 className="mt-3 font-serif text-4xl font-bold">Witaj w galerii</h1>
				<p className="mt-4 leading-7">
					Zeskanuj kod QR albo wpisz hasło z zaproszenia.
				</p>
				<LoginForm />
				<p className="mt-7 text-sm">
					Wchodząc do galerii, pamiętaj o naszej{" "}
					<Link href="/privacy" className="font-bold underline">
						informacji o prywatności
					</Link>
					.
				</p>
			</section>
		</main>
	);
}
