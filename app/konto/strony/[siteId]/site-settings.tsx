"use client";

import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type FormEvent, useState } from "react";
import { ArrowRightIcon } from "@/components/slideshow/icons";
import type { PublicSiteSettings } from "@/lib/accounts";
import type { PlanSummary } from "@/lib/billing/stripe";
import { formatGb, formatUsd, planStatusLabel } from "../../plan-labels";

type Props = {
	site: PublicSiteSettings;
	links: {
		guestUrl: string;
		adminUrl: string;
		guestQr: string;
		adminQr: string;
	};
	plan: PlanSummary;
	trialPhotoLimit: number;
	moderationAvailable: boolean;
	billingAvailable: boolean;
	billingNotice: "success" | "canceled" | null;
	platformHost: string;
};

/** ISO instant to the local wall-clock value a datetime-local field takes. */
function toLocalInput(iso: string | null) {
	if (!iso) return "";
	const date = new Date(iso);
	if (Number.isNaN(date.getTime())) return "";
	const pad = (value: number) => String(value).padStart(2, "0");
	return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string) {
	if (!value) return null;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function Field({
	id,
	label,
	hint,
	children,
}: {
	id: string;
	label: string;
	hint?: string;
	children: React.ReactNode;
}) {
	return (
		<div className="grid gap-2">
			<label htmlFor={id} className="ma-label">
				{label}
			</label>
			{children}
			{hint ? (
				<p id={`${id}-hint`} className="text-sm leading-relaxed text-ma-pine">
					{hint}
				</p>
			) : null}
		</div>
	);
}

function SectionHeading({
	title,
	children,
}: {
	title: string;
	children?: React.ReactNode;
}) {
	return (
		<div className="lg:col-span-4">
			<h2 className="font-serif text-[clamp(2rem,5vw,3.25rem)] leading-[0.95]">
				{title}
			</h2>
			<hr className="ma-rule mt-6" />
			{children ? (
				<div className="mt-6 grid gap-4 leading-relaxed text-ma-pine">
					{children}
				</div>
			) : null}
		</div>
	);
}

export function SiteSettings({
	site: initialSite,
	links,
	plan,
	trialPhotoLimit,
	moderationAvailable,
	billingAvailable,
	billingNotice,
	platformHost,
}: Props) {
	const router = useRouter();
	const [site, setSite] = useState(initialSite);
	const [message, setMessage] = useState("");
	const [error, setError] = useState("");
	const [pending, setPending] = useState<string | null>(null);

	async function call(path: string, method: string, body: unknown) {
		const response = await fetch(path, {
			method,
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		}).catch(() => null);
		const json = (await response?.json().catch(() => null)) as Record<
			string,
			unknown
		> | null;
		if (!response?.ok) {
			throw new Error(
				(typeof json?.error === "string" && json.error) ||
					"Coś poszło nie tak. Spróbuj ponownie.",
			);
		}
		return json ?? {};
	}

	async function saveSettings(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending("settings");
		setMessage("");
		setError("");
		const form = new FormData(event.currentTarget);
		const text = (name: string) => String(form.get(name) ?? "").trim();
		const patch: Record<string, unknown> = {
			title: text("title"),
			eventDate: text("eventDate") || null,
			guestJoinCode: text("guestJoinCode") || null,
			guestOpenUntil: fromLocalInput(text("guestOpenUntil")),
			deletionContactEmail: text("deletionContactEmail") || null,
			customDomain: text("customDomain") || null,
		};
		if (moderationAvailable) {
			patch.moderationEnabled = form.get("moderationEnabled") === "on";
		}
		const guest = String(form.get("guestPassphrase") ?? "");
		const admin = String(form.get("adminPassphrase") ?? "");
		if (guest) patch.guestPassphrase = guest;
		if (admin) patch.adminPassphrase = admin;
		try {
			const result = (await call(
				`/api/konto/sites/${site.id}`,
				"PATCH",
				patch,
			)) as {
				site?: PublicSiteSettings;
			};
			if (result.site) setSite(result.site);
			setMessage("Zapisano ustawienia.");
			(event.target as HTMLFormElement).reset();
			router.refresh();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Błąd zapisu.");
		} finally {
			setPending(null);
		}
	}

	async function rotate(which: "guest" | "admin") {
		const warning =
			which === "admin"
				? "Odnowić kod administratora? Stary kod QR przestanie działać i każde zalogowane urządzenie administratora zostanie wylogowane."
				: "Odnowić kod dla gości? Wydrukowane kody QR przestaną działać; goście z hasłem wejdą jak dotąd.";
		if (!window.confirm(warning)) return;
		setPending(which);
		setMessage("");
		setError("");
		try {
			await call(`/api/konto/sites/${site.id}/rotate`, "POST", { which });
			setMessage(
				which === "admin"
					? "Nowy kod administratora jest gotowy."
					: "Nowy kod dla gości jest gotowy.",
			);
			router.refresh();
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Błąd odnawiania.");
		} finally {
			setPending(null);
		}
	}

	async function billing(path: "checkout" | "portal") {
		setPending(path);
		setMessage("");
		setError("");
		try {
			const result = (await call(`/api/billing/${path}`, "POST", {
				siteId: site.id,
			})) as { url?: string };
			if (!result.url) throw new Error("Brak adresu płatności.");
			window.location.assign(result.url);
		} catch (caught) {
			setError(caught instanceof Error ? caught.message : "Błąd płatności.");
			setPending(null);
		}
	}

	const host = site.origin.replace(/^https?:\/\//, "");
	const periodEnd = plan.currentPeriodEnd
		? new Date(plan.currentPeriodEnd).toLocaleDateString("pl-PL", {
				dateStyle: "long",
			})
		: null;

	return (
		<main className="relative w-full grow px-5 sm:px-10 lg:px-16">
			<div className="mx-auto w-full max-w-6xl py-16">
				<header className="grid gap-8 lg:grid-cols-12 lg:items-end">
					<div className="lg:col-span-7">
						<p className="ma-label">Galeria</p>
						<h1 className="mt-3 font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
							{site.title}
						</h1>
						<hr className="ma-rule mt-6" />
					</div>
					<div className="lg:col-span-4 lg:col-start-9">
						<p className="break-all">
							<a
								href={site.origin}
								target="_blank"
								rel="noreferrer"
								className="underline decoration-ma-ash-deep hover:text-ma-ink-deep"
							>
								{host}
							</a>
						</p>
						<p className="mt-2 text-sm text-ma-pine">
							Plan: {planStatusLabel(site.planStatus)}
						</p>
						<Link
							href={`/konto/strony/${site.id}/wyglad`}
							className="ma-action ma-action--ghost mt-6"
						>
							Wygląd
							<ArrowRightIcon />
						</Link>
					</div>
				</header>

				<div aria-live="polite" className="mt-10 min-h-6">
					{billingNotice === "success" ? (
						<p className="font-medium text-ma-bottle">
							Dziękujemy. Płatność dotarła; status planu odświeży się, gdy
							Stripe potwierdzi subskrypcję.
						</p>
					) : null}
					{billingNotice === "canceled" ? (
						<p className="text-ma-pine">
							Płatność przerwana. Galeria pozostaje w dotychczasowym planie.
						</p>
					) : null}
					{message ? (
						<p className="font-medium text-ma-bottle">{message}</p>
					) : null}
					{error ? (
						<p role="alert" className="font-medium text-ma-oxblood">
							{error}
						</p>
					) : null}
				</div>

				{/* Entry codes */}
				<section className="mt-14 grid gap-10 border-t border-ma-ash pt-14 lg:grid-cols-12">
					<SectionHeading title="Kody wejścia">
						<p>
							Kod dla gości idzie na stoły i do zaproszeń. Kod administratora
							otwiera moderację; nie pokazuj go nikomu poza parą młodą.
						</p>
						<p>
							Odnowienie unieważnia stary kod. Nowy trzeba wydrukować od nowa.
						</p>
					</SectionHeading>
					<div className="grid gap-10 sm:grid-cols-2 lg:col-span-7 lg:col-start-6">
						{(
							[
								{
									which: "guest",
									label: "Goście",
									url: links.guestUrl,
									qr: links.guestQr,
								},
								{
									which: "admin",
									label: "Administrator",
									url: links.adminUrl,
									qr: links.adminQr,
								},
							] as const
						).map((entry) => (
							<div key={entry.which} className="grid gap-4">
								<p className="ma-label">{entry.label}</p>
								<Image
									src={entry.qr}
									unoptimized
									alt={`Kod QR: wejście dla roli ${entry.label.toLowerCase()}`}
									width={240}
									height={240}
									className="w-full max-w-60 border border-ma-ash"
								/>
								<p className="break-all text-sm">
									<a
										href={entry.url}
										className="underline decoration-ma-ash-deep hover:text-ma-ink-deep"
									>
										{entry.url}
									</a>
								</p>
								<div>
									<button
										type="button"
										disabled={pending === entry.which}
										onClick={() => rotate(entry.which)}
										className="ma-action ma-action--ghost"
									>
										{pending === entry.which ? "Odnawiamy…" : "Odnów kod"}
									</button>
								</div>
							</div>
						))}
					</div>
				</section>

				{/* Settings */}
				<section className="mt-14 grid gap-10 border-t border-ma-ash pt-14 lg:grid-cols-12">
					<SectionHeading title="Ustawienia">
						<p>
							Hasła zapisujemy tylko jako skróty. Puste pole hasła zostawia
							dotychczasowe.
						</p>
					</SectionHeading>
					<form
						onSubmit={saveSettings}
						className="grid gap-6 lg:col-span-7 lg:col-start-6"
					>
						<Field id="title" label="Tytuł">
							<input
								id="title"
								name="title"
								required
								maxLength={80}
								defaultValue={site.title}
								className="ma-field"
							/>
						</Field>
						<Field id="eventDate" label="Data wesela">
							<input
								id="eventDate"
								name="eventDate"
								type="date"
								defaultValue={site.eventDate ?? ""}
								className="ma-field"
							/>
						</Field>
						<div className="grid gap-6 sm:grid-cols-2">
							<Field id="guestPassphrase" label="Nowe hasło dla gości">
								<input
									id="guestPassphrase"
									name="guestPassphrase"
									type="password"
									minLength={4}
									autoComplete="new-password"
									className="ma-field"
								/>
							</Field>
							<Field id="adminPassphrase" label="Nowe hasło administratora">
								<input
									id="adminPassphrase"
									name="adminPassphrase"
									type="password"
									minLength={8}
									autoComplete="new-password"
									className="ma-field"
								/>
							</Field>
						</div>
						<Field
							id="guestOpenUntil"
							label="Dom otwarty do"
							hint="Do tej chwili każdy, kto otworzy adres galerii, wchodzi bez hasła. Zostaw puste, by zawsze wymagać hasła albo kodu."
						>
							<input
								id="guestOpenUntil"
								name="guestOpenUntil"
								type="datetime-local"
								defaultValue={toLocalInput(site.guestOpenUntil)}
								aria-describedby="guestOpenUntil-hint"
								className="ma-field"
							/>
						</Field>
						<Field
							id="guestJoinCode"
							label="Kod dołączenia"
							hint={`Krótki kod pokazywany jako QR w rogu pokazu slajdów: ${host}/p/<kod>. Litery, cyfry i myślniki, od 4 znaków.`}
						>
							<input
								id="guestJoinCode"
								name="guestJoinCode"
								minLength={4}
								maxLength={64}
								pattern="[A-Za-z0-9_-]{4,64}"
								autoComplete="off"
								spellCheck={false}
								defaultValue={site.guestJoinCode ?? ""}
								aria-describedby="guestJoinCode-hint"
								className="ma-field"
							/>
						</Field>
						<div className="grid gap-2">
							<label className="flex items-start gap-3">
								<input
									type="checkbox"
									name="moderationEnabled"
									defaultChecked={site.moderationEnabled}
									disabled={!moderationAvailable}
									aria-describedby="moderation-hint"
									className="mt-1 size-4 shrink-0 accent-ma-ink"
								/>
								<span className="ma-label pt-1 text-ma-ink">
									Automatyczna moderacja
								</span>
							</label>
							<p
								id="moderation-hint"
								className="text-sm leading-relaxed text-ma-pine"
							>
								{moderationAvailable
									? "Każde zdjęcie sprawdza Google Vision SafeSearch, zanim trafi do galerii; wątpliwe czekają na Twoją decyzję w panelu administratora. Wyłączona: zdjęcia pojawiają się od razu."
									: "Niedostępna na tym wdrożeniu: wymaga skonfigurowanego Google Vision. Zdjęcia pojawiają się w galerii od razu, a ukrywasz je ręcznie w panelu administratora."}
							</p>
						</div>
						<Field
							id="deletionContactEmail"
							label="E-mail kontaktowy dla gości"
							hint="Pokazywany w informacji o prywatności, gdy gość chce usunąć swoje zdjęcie."
						>
							<input
								id="deletionContactEmail"
								name="deletionContactEmail"
								type="email"
								autoComplete="email"
								defaultValue={site.deletionContactEmail ?? ""}
								aria-describedby="deletionContactEmail-hint"
								className="ma-field"
							/>
						</Field>
						<Field
							id="customDomain"
							label="Własna domena"
							hint={`Galeria zawsze działa pod ${site.slug}.${platformHost}. Własna domena musi być skierowana do Wianków: rekord CNAME na ${platformHost} oraz dodana jako custom hostname w Cloudflare tego wdrożenia. Bez tego kroku adres nie odpowie.`}
						>
							<input
								id="customDomain"
								name="customDomain"
								inputMode="url"
								autoComplete="off"
								spellCheck={false}
								placeholder="zdjecia.nasze-wesele.pl"
								defaultValue={site.customDomain ?? ""}
								aria-describedby="customDomain-hint"
								className="ma-field"
							/>
						</Field>
						<div>
							<button
								type="submit"
								disabled={pending === "settings"}
								className="ma-action"
							>
								{pending === "settings" ? "Zapisujemy…" : "Zapisz ustawienia"}
							</button>
						</div>
					</form>
				</section>

				{/* Plan */}
				<section className="mt-14 grid gap-10 border-t border-ma-ash pt-14 lg:grid-cols-12">
					<SectionHeading title="Plan">
						<p>
							{formatUsd(plan.yearlyUsd)} rocznie za galerię z{" "}
							{formatGb(plan.includedGb)} oryginałów. Każde kolejne{" "}
							{formatGb(10)} to {formatUsd(5)} rocznie, rozliczane na koniec
							okresu według stanu archiwum.
						</p>
						{plan.status === "trial" ? (
							<p>
								Wersja próbna przyjmuje do {trialPhotoLimit} zdjęć. Opłacona
								galeria nie ma limitu zdjęć; liczy się tylko rozmiar archiwum.
							</p>
						) : null}
						{plan.status === "canceled" ? (
							<p>
								Subskrypcja wygasła: galeria jest tylko do oglądania, dopóki nie
								zostanie opłacona ponownie.
							</p>
						) : null}
						{plan.status === "past_due" ? (
							<p>
								Ostatnia płatność nie powiodła się. Uaktualnij kartę w portalu
								płatności, zanim Stripe anuluje subskrypcję.
							</p>
						) : null}
					</SectionHeading>
					<div className="grid gap-8 lg:col-span-7 lg:col-start-6">
						<dl className="grid grid-cols-2 gap-x-8 gap-y-6 sm:grid-cols-4">
							<div>
								<dt className="ma-label">Status</dt>
								<dd className="mt-2 font-serif text-2xl leading-tight">
									{planStatusLabel(plan.status)}
								</dd>
							</div>
							<div>
								<dt className="ma-label">Zdjęcia</dt>
								<dd className="ma-numeral mt-2 text-3xl">
									{plan.photoCount}
									{plan.status === "trial" ? (
										<span className="text-base text-ma-pine">
											{" "}
											/ {trialPhotoLimit}
										</span>
									) : null}
								</dd>
							</div>
							<div>
								<dt className="ma-label">Archiwum</dt>
								<dd className="ma-numeral mt-2 text-3xl">
									{formatGb(plan.usedGb)}
									<span className="text-base text-ma-pine">
										{" "}
										/ {formatGb(plan.includedGb)}
									</span>
								</dd>
							</div>
							<div>
								<dt className="ma-label">Ponad plan</dt>
								<dd className="ma-numeral mt-2 text-3xl">
									{plan.blocks}
									<span className="text-base text-ma-pine">
										{" "}
										× {formatGb(10)}
									</span>
								</dd>
							</div>
						</dl>
						<p className="text-sm leading-relaxed text-ma-pine">
							{plan.blocks > 0
								? `Szacowana dopłata przy obecnym archiwum: ${formatUsd(plan.extraYearlyUsd)} rocznie.`
								: "Archiwum mieści się w planie; nie ma dopłaty."}
							{periodEnd ? ` Bieżący okres kończy się ${periodEnd}.` : ""}
						</p>
						{!billingAvailable ? (
							<p className="text-sm leading-relaxed text-ma-pine">
								Płatności nie są skonfigurowane na tym wdrożeniu, więc plan
								zmienia tylko jego administrator.
							</p>
						) : null}
						<div className="flex flex-wrap gap-4">
							{plan.status !== "active" ? (
								<button
									type="button"
									disabled={!billingAvailable || pending === "checkout"}
									onClick={() => billing("checkout")}
									className="ma-action"
								>
									{pending === "checkout"
										? "Przekierowujemy…"
										: `Opłać ${formatUsd(plan.yearlyUsd)} rocznie`}
								</button>
							) : null}
							{plan.hasCustomer ? (
								<button
									type="button"
									disabled={!billingAvailable || pending === "portal"}
									onClick={() => billing("portal")}
									className="ma-action ma-action--ghost"
								>
									{pending === "portal" ? "Otwieramy…" : "Zarządzaj płatnością"}
								</button>
							) : null}
						</div>
					</div>
				</section>
			</div>
		</main>
	);
}
