import Link from "next/link";
import { ArrowRightIcon } from "@/components/slideshow/icons";
import { listSitesForAccount } from "@/lib/accounts";
import { requireOwner } from "@/lib/auth/session";
import { serverEnv } from "@/lib/env";
import { getSiteUsage } from "@/lib/usage";
import { NewSiteForm } from "./new-site-form";
import { planStatusLabel } from "./plan-labels";

export const dynamic = "force-dynamic";

export default async function KontoPage() {
	const session = await requireOwner();
	const sites = await listSitesForAccount(session.accountId);
	const rows = await Promise.all(
		sites.map(async (site) => ({
			site,
			usage: await getSiteUsage(site.id),
		})),
	);

	return (
		<main className="relative w-full grow px-5 sm:px-10 lg:px-16">
			<div className="mx-auto w-full max-w-6xl py-16">
				<header className="grid gap-8 lg:grid-cols-12 lg:items-end">
					<div className="lg:col-span-7">
						<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
							Twoje galerie
						</h1>
						<hr className="ma-rule mt-6" />
					</div>
					<p className="leading-relaxed text-ma-pine lg:col-span-4 lg:col-start-9">
						Każda galeria ma własny adres, własne hasła i własne archiwum
						oryginałów. Goście nigdy nie widzą tej strony.
					</p>
				</header>

				{rows.length ? (
					<ul className="mt-14 border-t border-ma-ash">
						{rows.map(({ site, usage }) => (
							<li
								key={site.id}
								className="grid gap-4 border-b border-ma-ash py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center sm:gap-8"
							>
								<div className="min-w-0">
									<Link
										href={`/konto/strony/${site.id}`}
										className="font-serif text-3xl leading-tight underline-offset-4 hover:underline"
									>
										{site.title}
									</Link>
									<p className="mt-2 break-all text-sm">
										<a
											href={site.origin}
											className="underline decoration-ma-ash-deep hover:text-ma-ink-deep"
											target="_blank"
											rel="noreferrer"
										>
											{site.origin.replace(/^https?:\/\//, "")}
										</a>
									</p>
									<dl className="mt-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
										<div className="flex gap-2">
											<dt className="ma-label pt-1">Plan</dt>
											<dd>{planStatusLabel(site.plan_status)}</dd>
										</div>
										<div className="flex gap-2">
											<dt className="ma-label pt-1">Zdjęcia</dt>
											<dd className="tabular-nums">{usage.photoCount}</dd>
										</div>
									</dl>
								</div>
								<Link
									href={`/konto/strony/${site.id}`}
									className="ma-action ma-action--ghost"
								>
									Ustawienia
									<ArrowRightIcon />
								</Link>
							</li>
						))}
					</ul>
				) : (
					<div className="ma-empty mt-14">
						<p className="font-serif text-3xl leading-tight">
							Nie masz jeszcze żadnej galerii.
						</p>
					</div>
				)}

				<section className="mt-20 grid gap-10 lg:grid-cols-12">
					<div className="lg:col-span-4">
						<h2 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[0.95]">
							Nowa galeria
						</h2>
						<hr className="ma-rule mt-6" />
						<p className="mt-6 leading-relaxed text-ma-pine">
							Zaczyna się jako wersja próbna do 100 zdjęć. Hasło dla gości
							trafia na zaproszenia; hasło administratora zostaw dla siebie.
						</p>
					</div>
					<div className="lg:col-span-7 lg:col-start-6">
						<NewSiteForm platformHost={serverEnv().PLATFORM_HOST} />
					</div>
				</section>
			</div>
		</main>
	);
}
