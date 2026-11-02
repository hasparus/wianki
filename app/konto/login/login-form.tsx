"use client";

import { type FormEvent, useState } from "react";

type State =
	| { phase: "idle" }
	| { phase: "sent"; email: string; devLink: string | null };

export function LoginForm() {
	const [state, setState] = useState<State>({ phase: "idle" });
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		const email = String(new FormData(event.currentTarget).get("email") ?? "");
		const response = await fetch("/api/auth/owner/request", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ email }),
		}).catch(() => null);
		const body = (await response?.json().catch(() => null)) as {
			ok?: boolean;
			devLink?: string;
			error?: string;
		} | null;
		if (response?.ok && body?.ok) {
			setState({ phase: "sent", email, devLink: body.devLink ?? null });
		} else {
			setError(body?.error ?? "Nie udało się wysłać linku. Spróbuj ponownie.");
		}
		setPending(false);
	}

	if (state.phase === "sent") {
		return (
			<div aria-live="polite" className="grid gap-4">
				<p className="ma-label">Sprawdź skrzynkę</p>
				<p className="leading-relaxed">
					Jeśli <span className="font-medium">{state.email}</span> ma u nas
					konto albo może je założyć, link do logowania jest już w drodze.
					Działa 15 minut.
				</p>
				{state.devLink ? (
					<p className="border border-ma-ash p-4 text-sm leading-relaxed">
						<span className="ma-label mb-2">Tryb deweloperski</span>
						<a
							href={state.devLink}
							className="break-all underline decoration-ma-ash-deep hover:text-ma-ink-deep"
						>
							{state.devLink}
						</a>
					</p>
				) : null}
				<button
					type="button"
					onClick={() => setState({ phase: "idle" })}
					className="ma-action ma-action--ghost"
				>
					Wyślij ponownie
				</button>
			</div>
		);
	}

	return (
		<form onSubmit={submit} className="grid gap-4">
			<label htmlFor="email" className="ma-label">
				E-mail
			</label>
			<input
				id="email"
				name="email"
				type="email"
				required
				autoComplete="email"
				inputMode="email"
				className="ma-field"
			/>
			{error ? (
				<p role="alert" className="text-sm font-medium text-ma-oxblood">
					{error}
				</p>
			) : null}
			<button type="submit" disabled={pending} className="ma-action">
				{pending ? "Wysyłamy…" : "Wyślij link do logowania"}
			</button>
		</form>
	);
}
