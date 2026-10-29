"use client";

import { type FormEvent, useState } from "react";

export function NewSiteForm({ platformHost }: { platformHost: string }) {
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);
	const [slug, setSlug] = useState("");

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		const form = new FormData(event.currentTarget);
		const response = await fetch("/api/konto/sites", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				slug: form.get("slug"),
				title: form.get("title"),
				guestPassphrase: form.get("guestPassphrase"),
				adminPassphrase: form.get("adminPassphrase"),
				deletionContactEmail: form.get("deletionContactEmail"),
			}),
		}).catch(() => null);
		const body = (await response?.json().catch(() => null)) as {
			site?: { id: string };
			error?: string;
		} | null;
		if (response?.ok && body?.site) {
			window.location.assign(`/konto/strony/${body.site.id}`);
			return;
		}
		setError(body?.error ?? "Nie udało się utworzyć galerii.");
		setPending(false);
	}

	return (
		<form onSubmit={submit} className="grid gap-6">
			<div className="grid gap-2">
				<label htmlFor="new-slug" className="ma-label">
					Adres
				</label>
				<input
					id="new-slug"
					name="slug"
					required
					minLength={3}
					maxLength={40}
					pattern="[a-z0-9][a-z0-9-]{2,39}"
					autoComplete="off"
					spellCheck={false}
					value={slug}
					onChange={(event) =>
						setSlug(event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ""))
					}
					aria-describedby="new-slug-hint"
					className="ma-field"
				/>
				<p id="new-slug-hint" className="break-all text-sm text-ma-pine">
					{slug || "nazwa"}.{platformHost} — małe litery, cyfry i myślniki.
				</p>
			</div>
			<div className="grid gap-2">
				<label htmlFor="new-title" className="ma-label">
					Tytuł
				</label>
				<input
					id="new-title"
					name="title"
					required
					maxLength={80}
					placeholder="Ania & Tomek"
					className="ma-field"
				/>
			</div>
			<div className="grid gap-6 sm:grid-cols-2">
				<div className="grid gap-2">
					<label htmlFor="new-guest" className="ma-label">
						Hasło dla gości
					</label>
					<input
						id="new-guest"
						name="guestPassphrase"
						type="password"
						required
						minLength={4}
						autoComplete="new-password"
						className="ma-field"
					/>
				</div>
				<div className="grid gap-2">
					<label htmlFor="new-admin" className="ma-label">
						Hasło administratora
					</label>
					<input
						id="new-admin"
						name="adminPassphrase"
						type="password"
						required
						minLength={8}
						autoComplete="new-password"
						className="ma-field"
					/>
				</div>
			</div>
			<div className="grid gap-2">
				<label htmlFor="new-contact" className="ma-label">
					E-mail kontaktowy dla gości
				</label>
				<input
					id="new-contact"
					name="deletionContactEmail"
					type="email"
					required
					autoComplete="email"
					aria-describedby="new-contact-hint"
					className="ma-field"
				/>
				<p id="new-contact-hint" className="text-sm text-ma-pine">
					Pokazywany w informacji o prywatności, gdy gość chce usunąć swoje
					zdjęcie.
				</p>
			</div>
			{error ? (
				<p role="alert" className="text-sm font-medium text-ma-oxblood">
					{error}
				</p>
			) : null}
			<div>
				<button type="submit" disabled={pending} className="ma-action">
					{pending ? "Tworzymy…" : "Utwórz galerię"}
				</button>
			</div>
		</form>
	);
}
