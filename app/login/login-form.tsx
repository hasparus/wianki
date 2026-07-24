"use client";

import { type FormEvent, useState } from "react";

export function LoginForm() {
	const [error, setError] = useState("");
	const [pending, setPending] = useState(false);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		const form = new FormData(event.currentTarget);
		const response = await fetch("/api/auth/guest", {
			method: "POST",
			body: form,
		});
		if (response.ok) {
			window.location.assign("/");
			return;
		}
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		setError(body?.error ?? "Nie udało się zalogować.");
		setPending(false);
	}

	return (
		<form onSubmit={submit} className="mt-8 grid gap-4">
			<label htmlFor="passphrase" className="font-semibold">
				Hasło z zaproszenia
			</label>
			<input
				id="passphrase"
				name="passphrase"
				type="password"
				required
				autoComplete="current-password"
				className="min-h-12 rounded-2xl border-2 border-wedding-green bg-white px-4"
			/>
			{error ? (
				<p role="alert" className="text-sm font-semibold text-wedding-error">
					{error}
				</p>
			) : null}
			<button
				type="submit"
				disabled={pending}
				className="min-h-12 rounded-full bg-wedding-green px-6 font-bold text-wedding-rose transition hover:bg-wedding-green-soft disabled:cursor-wait disabled:opacity-60"
			>
				{pending ? "Sprawdzamy…" : "Wejdź do galerii"}
			</button>
		</form>
	);
}
