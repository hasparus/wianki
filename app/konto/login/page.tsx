import Link from "next/link";
import { LoginForm } from "./login-form";

export default async function OwnerLoginPage({
	searchParams,
}: {
	searchParams: Promise<{ error?: string }>;
}) {
	const { error } = await searchParams;
	return (
		<main className="relative flex w-full grow flex-col px-5 sm:px-10 lg:px-16">
			<div className="mx-auto flex w-full max-w-6xl grow flex-col justify-end pb-[9vh] pt-[14vh] sm:pb-[11vh] sm:pt-[18vh]">
				<div className="grid gap-16 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:items-end lg:gap-24">
					<div>
						<h1 className="font-serif text-[clamp(3rem,11vw,6.5rem)] leading-[0.92] tracking-[-0.02em]">
							Konto
						</h1>
						<hr className="ma-rule mt-8" />
						<p className="mt-8 max-w-sm text-lg leading-relaxed text-ma-pine">
							Podaj adres e-mail, a wyślemy link do logowania. Bez hasła, bez
							rejestracji: pierwsze logowanie zakłada konto.
						</p>
					</div>
					<div>
						{error === "expired" ? (
							<p role="alert" className="mb-6 font-medium text-ma-oxblood">
								Ten link wygasł albo został już użyty. Poproś o nowy.
							</p>
						) : null}
						<LoginForm />
						<Link
							href="/cennik"
							className="ma-label mt-8 inline-block underline decoration-ma-ash-deep hover:text-ma-ink"
						>
							Cennik
						</Link>
					</div>
				</div>
			</div>
		</main>
	);
}
