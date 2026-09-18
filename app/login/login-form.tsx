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
			const body = (await response.json().catch(() => null)) as {
				redirect?: string;
			} | null;
			window.location.assign(body?.redirect ?? "/");
			return;
		}
		const body = (await response.json().catch(() => null)) as {
			error?: string;
		} | null;
		setError(body?.error ?? "Nie udało się zalogować.");
		setPending(false);
	}

	return (
		<form onSubmit={submit} className="grid gap-4">
			<label htmlFor="passphrase" className="ma-label">
				Hasło
			</label>
			<input
				id="passphrase"
				name="passphrase"
				type="password"
				required
				autoComplete="current-password"
				className="ma-field"
			/>
			{error ? (
				<p role="alert" className="text-sm font-medium text-ma-oxblood">
					{error}
				</p>
			) : null}
			<button type="submit" disabled={pending} className="ma-action">
				{pending ? "Sprawdzamy…" : "Wejdź do galerii"}
			</button>
		</form>
	);
}
