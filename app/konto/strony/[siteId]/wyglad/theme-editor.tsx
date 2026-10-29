"use client";

import Link from "next/link";
import { type FormEvent, useMemo, useState } from "react";
import { readError } from "@/lib/http-client";
import {
	AA_CONTRAST,
	CUSTOM_CSS_MAX,
	contrastIssues,
	DEFAULT_TOKENS,
	FONT_IDS,
	FONT_LABELS,
	type FontId,
	isHexColor,
	normalizeHex,
	PRESETS,
	type Preset,
	type PresetId,
	resolveTokens,
	type SiteTheme,
	TOKEN_LABELS,
	TOKEN_NAMES,
	type TokenName,
	themeToCss,
} from "@/lib/theme";

const SWATCH_TOKENS: TokenName[] = [
	"plaster",
	"plaster-lit",
	"ash",
	"pine",
	"ink",
	"bronze",
];

/**
 * Drops every field that says "default", so the saved JSON for an untouched
 * site is `{}` and "Przywróć domyślne" and a fresh site are the same thing.
 */
function clean(theme: SiteTheme): SiteTheme {
	const next: SiteTheme = {};
	if (theme.preset && theme.preset !== "tokonoma") next.preset = theme.preset;
	if (theme.tokens) {
		const tokens: Partial<Record<TokenName, string>> = {};
		for (const name of TOKEN_NAMES) {
			const value = theme.tokens[name];
			if (isHexColor(value)) tokens[name] = normalizeHex(value);
		}
		if (Object.keys(tokens).length > 0) next.tokens = tokens;
	}
	if (theme.font && theme.font !== "instrument-serif") next.font = theme.font;
	if (theme.texture === false) next.texture = false;
	if (theme.customCss?.trim()) next.customCss = theme.customCss;
	return next;
}

function PresetSwatches({ preset }: { preset: Preset }) {
	const tokens = { ...DEFAULT_TOKENS, ...preset.tokens };
	return (
		<span className="flex h-5 w-full" aria-hidden>
			{SWATCH_TOKENS.map((name) => (
				<span
					key={name}
					className="flex-1 border-y border-ma-ash first:border-l last:border-r"
					style={{ backgroundColor: tokens[name] }}
				/>
			))}
		</span>
	);
}

/** A miniature of the login screen, styled only by the generated CSS. */
function ThemePreview({ css, title }: { css: string; title: string }) {
	// Keyed by the running prefix, which is unique per position without an index.
	let prefix = "";
	const names = title.split(/\s+&\s+/).map((part) => {
		prefix = `${prefix}&${part}`;
		return { part, key: prefix };
	});
	return (
		<div
			className="theme-preview border border-ma-ash text-ma-ink"
			style={{
				backgroundColor: "var(--ma-plaster)",
				backgroundImage: "var(--ma-plaster-surface)",
				backgroundRepeat: "repeat",
				backgroundSize: "var(--ma-tile)",
			}}
		>
			{css ? (
				// biome-ignore lint/security/noDangerouslySetInnerHtml: themeToCss emits validated tokens and sanitized CSS only.
				<style dangerouslySetInnerHTML={{ __html: css }} />
			) : null}
			<div className="px-6 pt-10 pb-8">
				<p className="font-serif text-[2.5rem] leading-[0.92] tracking-[-0.02em]">
					{names.map(({ part, key }) => (
						<span key={key}>
							{key === names[0].key ? null : (
								<span className="text-ma-pine"> &amp; </span>
							)}
							{part}
						</span>
					))}
				</p>
				<hr className="ma-rule mt-5" />
				<p className="mt-5 text-sm leading-relaxed text-ma-pine">
					Zeskanuj kod QR albo wpisz hasło z zaproszenia.
				</p>
				<div className="mt-6 grid gap-3">
					<span className="ma-label">Hasło</span>
					<span className="ma-field flex items-center text-ma-pine">
						••••••••
					</span>
					<span className="ma-action">Wejdź do galerii</span>
					<span className="ma-action ma-action--ghost">
						Informacja o prywatności
					</span>
				</div>
				<div className="ma-plane mt-6 p-3">
					<div className="aspect-[4/3] w-full bg-ma-ash" aria-hidden />
					<p className="ma-label mt-3">Zdjęcie gościa</p>
				</div>
				<p className="mt-5 text-sm font-medium text-ma-oxblood">
					Nie udało się zalogować.
				</p>
				<p className="mt-1 text-sm font-medium text-ma-bottle">
					Zdjęcia zapisane.
				</p>
			</div>
			<div className="ma-base" aria-hidden />
		</div>
	);
}

export function ThemeEditor({
	siteId,
	siteTitle,
	siteOrigin,
	initialTheme,
}: {
	siteId: string;
	siteTitle: string;
	siteOrigin: string;
	initialTheme: SiteTheme;
}) {
	const [theme, setTheme] = useState<SiteTheme>(() => clean(initialTheme));
	const [hexDrafts, setHexDrafts] = useState<
		Partial<Record<TokenName, string>>
	>({});
	const [pending, setPending] = useState(false);
	const [dirty, setDirty] = useState(false);
	const [notice, setNotice] = useState("");
	const [error, setError] = useState("");

	const resolved = useMemo(() => resolveTokens(theme), [theme]);
	const css = useMemo(() => themeToCss(theme), [theme]);
	// The same CSS the site will receive, re-rooted at the preview box.
	const previewCss = useMemo(
		() => css.replaceAll(":root", ".theme-preview"),
		[css],
	);
	const issues = useMemo(() => contrastIssues(resolved), [resolved]);
	const presetId: PresetId = theme.preset ?? "tokonoma";
	const fontId: FontId = theme.font ?? "instrument-serif";

	function update(patch: Partial<SiteTheme>) {
		setTheme((current) => clean({ ...current, ...patch }));
		setDirty(true);
		setNotice("");
		setError("");
	}

	function choosePreset(id: PresetId) {
		// Overrides were tuned against the previous palette; a new one starts clean.
		setHexDrafts({});
		update({ preset: id, tokens: undefined });
	}

	function setToken(name: TokenName, value: string) {
		update({ tokens: { ...theme.tokens, [name]: normalizeHex(value) } });
	}

	function clearToken(name: TokenName) {
		const tokens = { ...theme.tokens };
		delete tokens[name];
		setHexDrafts((current) => ({ ...current, [name]: undefined }));
		update({ tokens });
	}

	function typeHex(name: TokenName, text: string) {
		setHexDrafts((current) => ({ ...current, [name]: text }));
		if (isHexColor(text)) setToken(name, text);
	}

	function resetAll() {
		setHexDrafts({});
		setTheme({});
		setDirty(true);
		setError("");
		setNotice("Przywrócono domyślny wygląd. Zapisz, aby zastosować.");
	}

	async function save(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		setPending(true);
		setError("");
		setNotice("");
		try {
			const response = await fetch(`/api/konto/sites/${siteId}/theme`, {
				method: "PUT",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ theme }),
			});
			if (!response.ok) {
				setError(await readError(response, "Nie udało się zapisać wyglądu."));
				return;
			}
			setDirty(false);
			setNotice("Zapisano. Goście zobaczą nowy wygląd po odświeżeniu galerii.");
		} catch {
			setError("Nie udało się zapisać wyglądu. Sprawdź połączenie.");
		} finally {
			setPending(false);
		}
	}

	return (
		<>
			<main className="relative w-full grow px-5 sm:px-10 lg:px-16">
				<div className="mx-auto w-full max-w-6xl py-16">
					<header className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
						<div>
							<h1 className="font-serif text-[clamp(2.75rem,9vw,5.5rem)] leading-[0.95] tracking-[-0.02em]">
								Wygląd galerii
							</h1>
							<hr className="ma-rule mt-6" />
							<p className="mt-8 max-w-xl leading-relaxed text-ma-pine">
								{siteTitle}. Wybierz szablon, dostrój kolory i czcionkę albo
								dopisz własny CSS. Zdjęcia gości są pomyślane jako jedyny kolor
								w galerii, ale to Twoja strona i Twój wybór.
							</p>
						</div>
						<div className="flex flex-wrap gap-3">
							<Link
								href={`/konto/strony/${siteId}`}
								className="ma-action ma-action--ghost"
							>
								Wróć do strony
							</Link>
							<a
								href={siteOrigin}
								target="_blank"
								rel="noreferrer"
								className="ma-action ma-action--ghost"
							>
								Otwórz galerię
							</a>
						</div>
					</header>

					<div className="mt-16 grid gap-12 lg:grid-cols-[minmax(0,1fr)_minmax(0,22rem)] lg:gap-16">
						<form onSubmit={save} className="min-w-0">
							<fieldset className="m-0 border-0 p-0">
								<legend className="font-serif text-3xl leading-tight">
									Szablon
								</legend>
								<hr className="ma-rule mt-4" />
								<div className="mt-6 grid gap-3 sm:grid-cols-2">
									{PRESETS.map((preset) => (
										<label
											key={preset.id}
											className="block min-h-11 cursor-pointer border border-ma-ash bg-ma-plaster-lit p-4 has-[:checked]:border-ma-ink has-[:checked]:bg-ma-paper has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-offset-3 has-[:focus-visible]:outline-ma-ink hover:border-ma-pine"
										>
											<input
												type="radio"
												name="preset"
												value={preset.id}
												checked={presetId === preset.id}
												onChange={() => choosePreset(preset.id)}
												className="sr-only"
											/>
											<PresetSwatches preset={preset} />
											<span className="mt-3 block font-serif text-2xl leading-tight">
												{preset.name}
											</span>
											<span className="mt-1 block text-sm leading-snug text-ma-pine">
												{preset.description}
											</span>
										</label>
									))}
								</div>
								<p className="mt-4 text-sm text-ma-pine">
									Wybór szablonu czyści własne kolory poniżej.
								</p>
							</fieldset>

							<section aria-labelledby="theme-colors-title" className="mt-16">
								<h2
									id="theme-colors-title"
									className="font-serif text-3xl leading-tight"
								>
									Kolory
								</h2>
								<hr className="ma-rule mt-4" />
								<ul className="mt-6 border-t border-ma-ash">
									{TOKEN_NAMES.map((name) => {
										const overridden = Boolean(theme.tokens?.[name]);
										const hexId = `theme-token-${name}-hex`;
										const colorId = `theme-token-${name}`;
										const text = hexDrafts[name] ?? resolved[name];
										return (
											<li
												key={name}
												className="grid items-center gap-3 border-b border-ma-ash py-3 sm:grid-cols-[minmax(0,1fr)_auto_auto_auto]"
											>
												<div className="min-w-0">
													<label htmlFor={colorId} className="ma-label">
														{TOKEN_LABELS[name]}
													</label>
													<span className="mt-1 block font-mono text-xs text-ma-pine">
														--ma-{name}
													</span>
												</div>
												<input
													id={colorId}
													type="color"
													value={resolved[name]}
													onChange={(event) =>
														setToken(name, event.target.value)
													}
													className="h-11 w-14 cursor-pointer border border-ma-ash-deep bg-ma-paper p-1"
												/>
												<input
													id={hexId}
													type="text"
													inputMode="text"
													spellCheck={false}
													maxLength={7}
													aria-label={`${TOKEN_LABELS[name]} — zapis szesnastkowy`}
													aria-invalid={!isHexColor(text) || undefined}
													value={text}
													onChange={(event) =>
														typeHex(name, event.target.value)
													}
													onBlur={() =>
														setHexDrafts((current) => ({
															...current,
															[name]: undefined,
														}))
													}
													className="ma-field w-28 font-mono text-sm"
												/>
												<button
													type="button"
													onClick={() => clearToken(name)}
													disabled={!overridden}
													className="ma-action ma-action--quiet text-xs"
												>
													Domyślny
												</button>
											</li>
										);
									})}
								</ul>
								{issues.length > 0 ? (
									<div role="status" className="mt-6 grid gap-1">
										<span className="ma-label">Uwaga na czytelność</span>
										{issues.map((issue) => (
											<p key={`${issue.fg}-${issue.bg}`} className="text-sm">
												Kontrast ({issue.label}) wynosi{" "}
												{issue.ratio.toFixed(1).replace(".", ",")}:1, poniżej{" "}
												{String(AA_CONTRAST).replace(".", ",")}:1 zalecanego
												przez WCAG. Część gości może mieć trudność z
												odczytaniem.
											</p>
										))}
									</div>
								) : null}
							</section>

							<section aria-labelledby="theme-type-title" className="mt-16">
								<h2
									id="theme-type-title"
									className="font-serif text-3xl leading-tight"
								>
									Czcionka i faktura
								</h2>
								<hr className="ma-rule mt-4" />
								<div className="mt-6 grid max-w-xl gap-3">
									<label htmlFor="theme-font" className="ma-label">
										Czcionka tytułów
									</label>
									<select
										id="theme-font"
										value={fontId}
										onChange={(event) =>
											update({ font: event.target.value as FontId })
										}
										className="ma-field"
									>
										{FONT_IDS.map((id) => (
											<option key={id} value={id}>
												{FONT_LABELS[id]}
											</option>
										))}
									</select>
									<label
										htmlFor="theme-texture"
										className="mt-3 flex min-h-11 cursor-pointer items-center gap-3"
									>
										<input
											id="theme-texture"
											type="checkbox"
											checked={theme.texture !== false}
											onChange={(event) =>
												update({ texture: event.target.checked })
											}
											className="size-5 accent-ma-ink"
										/>
										<span>Faktura tynku i brązu na tle</span>
									</label>
								</div>
							</section>

							<section aria-labelledby="theme-css-title" className="mt-16">
								<h2
									id="theme-css-title"
									className="font-serif text-3xl leading-tight"
								>
									Własny CSS
								</h2>
								<hr className="ma-rule mt-4" />
								<div className="mt-6 grid gap-3">
									<label htmlFor="theme-css" className="ma-label">
										Arkusz stylów strony
									</label>
									<textarea
										id="theme-css"
										value={theme.customCss ?? ""}
										onChange={(event) =>
											update({ customCss: event.target.value })
										}
										maxLength={CUSTOM_CSS_MAX}
										spellCheck={false}
										rows={10}
										placeholder={":root{--ma-ink:#223}"}
										className="ma-field min-h-48 w-full resize-y py-3 font-mono text-sm leading-relaxed"
									/>
									<p className="text-sm leading-relaxed text-ma-pine">
										Dopisywany na końcu, po kolorach i czcionce. Kolory strony
										to zmienne{" "}
										<code className="font-mono text-xs">
											{TOKEN_NAMES.map((name) => `--ma-${name}`).join(", ")}
										</code>
										, na przykład{" "}
										<code className="font-mono text-xs">
											{":root{--ma-ink:#223}"}
										</code>
										. Reguły <code className="font-mono text-xs">@import</code>{" "}
										i skrypty są usuwane; własne obrazy przez{" "}
										<code className="font-mono text-xs">url()</code> działają.
										Podgląd obok pokazuje reguły{" "}
										<code className="font-mono text-xs">:root</code>; pozostałe
										sprawdź w otwartej galerii. Najwyżej{" "}
										{CUSTOM_CSS_MAX.toLocaleString("pl-PL")} znaków.
									</p>
								</div>
							</section>

							<div className="mt-16 flex flex-wrap items-center gap-4 border-t border-ma-ash pt-8">
								<button type="submit" disabled={pending} className="ma-action">
									{pending ? "Zapisujemy…" : "Zapisz"}
								</button>
								<button
									type="button"
									onClick={resetAll}
									disabled={pending}
									className="ma-action ma-action--ghost"
								>
									Przywróć domyślne
								</button>
								{dirty && !pending ? (
									<span className="ma-label">Niezapisane zmiany</span>
								) : null}
								{error ? (
									<p
										role="alert"
										className="w-full font-medium text-ma-oxblood"
									>
										{error}
									</p>
								) : null}
								{notice ? (
									<p
										role="status"
										className="w-full font-medium text-ma-bottle"
									>
										{notice}
									</p>
								) : null}
							</div>
						</form>

						<aside
							aria-label="Podgląd wyglądu"
							className="min-w-0 self-start lg:sticky lg:top-8"
						>
							<span className="ma-label">Podgląd</span>
							<div className="mt-4">
								<ThemePreview css={previewCss} title={siteTitle} />
							</div>
						</aside>
					</div>
				</div>
			</main>
			<div className="ma-base" aria-hidden />
		</>
	);
}
