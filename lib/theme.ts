import { z } from "zod";

/**
 * A site's look. The default world is the tokonoma in app/globals.css; a
 * theme is a short list of deviations from it, stored as JSON in
 * `sites.theme_json` and turned into one `<style>` element per request.
 *
 * Pure and isomorphic on purpose: the owner console imports `themeToCss`
 * into the browser to preview a theme before saving it, so nothing in here
 * may touch Node, D1 or Next.
 */

export const TOKEN_NAMES = [
	"plaster",
	"plaster-lit",
	"paper",
	"ash",
	"ash-deep",
	"pine",
	"disabled",
	"bronze",
	"ink",
	"ink-deep",
	"oxblood",
	"bottle",
] as const;

export type TokenName = (typeof TOKEN_NAMES)[number];

/** Editor copy: what each token does, in the owner's words. */
export const TOKEN_LABELS: Record<TokenName, string> = {
	plaster: "Tło strony",
	"plaster-lit": "Tło paneli i tekst na przyciskach",
	paper: "Wnętrze pól",
	ash: "Cienkie linie",
	"ash-deep": "Obrys pól i podkreślenia",
	pine: "Tekst pomocniczy",
	disabled: "Tekst wyłączonych przycisków",
	bronze: "Ciemna podstawa (stopka)",
	ink: "Tekst i przyciski",
	"ink-deep": "Wciśnięty przycisk, tło pokazu",
	oxblood: "Błędy",
	bottle: "Potwierdzenia",
};

/**
 * The tokonoma values, mirrored from app/globals.css so the editor can draw
 * swatches and seed its colour inputs. `test/theme.test.ts` keeps the two in
 * step; the stylesheet stays the source of truth for the rendered default.
 */
export const DEFAULT_TOKENS: Record<TokenName, string> = {
	plaster: "#efefef",
	"plaster-lit": "#f7f7f7",
	paper: "#ffffff",
	ash: "#d8d8d8",
	"ash-deep": "#b4b4b4",
	pine: "#666666",
	disabled: "#767676",
	bronze: "#2a2a2a",
	ink: "#1a1a1a",
	"ink-deep": "#0a0a0a",
	oxblood: "#8c2318",
	bottle: "#1e4d2b",
};

export const FONT_IDS = [
	"instrument-serif",
	"system-serif",
	"system-sans",
] as const;

export type FontId = (typeof FONT_IDS)[number];

export const FONT_LABELS: Record<FontId, string> = {
	"instrument-serif": "Instrument Serif (domyślna)",
	"system-serif": "Szeryfowa systemowa",
	"system-sans": "Bezszeryfowa systemowa",
};

/** Same stack `@theme inline` sets as `--font-sans` in app/globals.css. */
const SANS_STACK =
	'ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, Helvetica, Arial, sans-serif';

const FONT_STACKS: Record<FontId, string | null> = {
	"instrument-serif": null,
	"system-serif": '"Iowan Old Style", Georgia, serif',
	"system-sans": SANS_STACK,
};

export const CUSTOM_CSS_MAX = 20_000;

export type Preset = {
	id: PresetId;
	name: string;
	description: string;
	tokens: Partial<Record<TokenName, string>>;
};

export const PRESET_IDS = [
	"tokonoma",
	"noc",
	"len",
	"grafit",
	"pergamin",
	"oliwka",
] as const;

export type PresetId = (typeof PRESET_IDS)[number];

/**
 * Starting points. Every preset keeps AA contrast on the three pairings
 * that carry text: ink on plaster, pine on plaster, plaster-lit on ink.
 */
export const PRESETS: readonly Preset[] = [
	{
		id: "tokonoma",
		name: "Tokonoma",
		description:
			"Domyślna alkowa: tynk, tusz i brąz, kolor tylko na zdjęciach.",
		tokens: {},
	},
	{
		id: "noc",
		name: "Noc",
		description:
			"Ten sam świat odwrócony, jak na pokazie: tusz na ścianie, jasny tekst.",
		tokens: {
			plaster: "#0a0a0a",
			"plaster-lit": "#161616",
			paper: "#1e1e1e",
			ash: "#2c2c2c",
			"ash-deep": "#5c5c5c",
			pine: "#a3a3a3",
			disabled: "#8f8f8f",
			bronze: "#e4e4e4",
			ink: "#efefef",
			"ink-deep": "#ffffff",
			oxblood: "#e08a7d",
			bottle: "#8fcf9e",
		},
	},
	{
		id: "len",
		name: "Len",
		description: "Ciepłe złamane biele i miękki umbrowy tusz.",
		tokens: {
			plaster: "#f3efe6",
			"plaster-lit": "#faf7f0",
			paper: "#fffdf8",
			ash: "#ddd6c8",
			"ash-deep": "#b8ae9c",
			pine: "#6b6257",
			disabled: "#767068",
			bronze: "#3a322a",
			ink: "#2b2420",
			"ink-deep": "#16110e",
		},
	},
	{
		id: "grafit",
		name: "Grafit",
		description: "Chłodne ciemne szarości, jasne pismo.",
		tokens: {
			plaster: "#1c1e21",
			"plaster-lit": "#24272b",
			paper: "#2b2f34",
			ash: "#3a3f45",
			"ash-deep": "#6b7178",
			pine: "#a7adb4",
			disabled: "#8e949b",
			bronze: "#d9dde2",
			ink: "#e8eaed",
			"ink-deep": "#ffffff",
			oxblood: "#e08a7d",
			bottle: "#8fcf9e",
		},
	},
	{
		id: "pergamin",
		name: "Pergamin",
		description: "Ciepły papier i głęboki brązowy tusz.",
		tokens: {
			plaster: "#ede4d0",
			"plaster-lit": "#f5eedd",
			paper: "#fbf6e9",
			ash: "#d6cbb2",
			"ash-deep": "#ad9f82",
			pine: "#6a5a44",
			disabled: "#75665a",
			bronze: "#4a3728",
			ink: "#3b2a1a",
			"ink-deep": "#221609",
		},
	},
	{
		id: "oliwka",
		name: "Oliwka",
		description: "Szarozielone tynki i tusz koloru mchu.",
		tokens: {
			plaster: "#e9ebe2",
			"plaster-lit": "#f2f3ec",
			paper: "#fafbf6",
			ash: "#cfd3c3",
			"ash-deep": "#a8ad9a",
			pine: "#5f6552",
			disabled: "#6f7466",
			bronze: "#2f3328",
			ink: "#1f2219",
			"ink-deep": "#0e100a",
		},
	},
];

export function findPreset(id: string | undefined): Preset {
	return PRESETS.find((preset) => preset.id === id) ?? PRESETS[0];
}

const HEX_COLOR = /^#(?:[0-9a-f]{3}|[0-9a-f]{6})$/i;

export function isHexColor(value: unknown): value is string {
	return typeof value === "string" && HEX_COLOR.test(value);
}

/** `#abc` and `#AABBCC` both become `#aabbcc`, the form `<input type="color">` needs. */
export function normalizeHex(value: string) {
	const hex = value.trim().toLowerCase();
	if (hex.length === 4) {
		return `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
	}
	return hex;
}

const hexColorSchema = z
	.string()
	.trim()
	.regex(HEX_COLOR, "kolor w zapisie #rgb albo #rrggbb")
	.transform(normalizeHex);

export const themeSchema = z.object({
	preset: z.enum(PRESET_IDS).optional(),
	tokens: z.partialRecord(z.enum(TOKEN_NAMES), hexColorSchema).optional(),
	font: z.enum(FONT_IDS).optional(),
	texture: z.boolean().optional(),
	customCss: z.string().max(CUSTOM_CSS_MAX).optional(),
});

export type SiteTheme = z.infer<typeof themeSchema>;

export const defaultTheme: Readonly<SiteTheme> = Object.freeze({});

/**
 * Lenient on purpose: this runs on every page of every site, and a row with
 * a damaged theme must still render the default world rather than 500.
 * Each field is parsed on its own, so one bad token drops that token only.
 */
export function parseTheme(json: string | null | undefined): SiteTheme {
	let raw: unknown;
	try {
		raw = JSON.parse(json || "{}");
	} catch {
		return {};
	}
	if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
	const input = raw as Record<string, unknown>;
	const theme: SiteTheme = {};

	const preset = themeSchema.shape.preset.safeParse(input.preset);
	if (preset.success && preset.data) theme.preset = preset.data;

	if (input.tokens && typeof input.tokens === "object") {
		const tokens: Partial<Record<TokenName, string>> = {};
		for (const name of TOKEN_NAMES) {
			const value = hexColorSchema.safeParse(
				(input.tokens as Record<string, unknown>)[name],
			);
			if (value.success) tokens[name] = value.data;
		}
		if (Object.keys(tokens).length > 0) theme.tokens = tokens;
	}

	const font = themeSchema.shape.font.safeParse(input.font);
	if (font.success && font.data) theme.font = font.data;

	if (typeof input.texture === "boolean") theme.texture = input.texture;

	if (typeof input.customCss === "string" && input.customCss.length > 0) {
		theme.customCss = input.customCss.slice(0, CUSTOM_CSS_MAX);
	}

	return theme;
}

/** The colour each token ends up with: default, then preset, then the site's own. */
export function resolveTokens(theme: SiteTheme): Record<TokenName, string> {
	const resolved = { ...DEFAULT_TOKENS, ...findPreset(theme.preset).tokens };
	for (const name of TOKEN_NAMES) {
		const value = theme.tokens?.[name];
		if (isHexColor(value)) resolved[name] = normalizeHex(value);
	}
	return resolved;
}

/**
 * Keeps an owner's stylesheet inside the style element it is printed into.
 * Owners may reference their own images with url(); what is removed is the
 * handful of constructs that could run script or close the element.
 */
export function sanitizeCustomCss(css: string) {
	return css
		.slice(0, CUSTOM_CSS_MAX)
		.replace(/<\/style\s*>?/gi, "")
		.replace(/@import\b[^;{]*(?:;|(?=[}]))?/gi, "")
		.replace(/expression\s*\(/gi, "")
		.replace(/-moz-binding/gi, "")
		.replace(/behavior\s*:/gi, "")
		.replace(/javascript\s*:/gi, "")
		.trim();
}

/**
 * One rule for tokens, one for the display face, then the owner's own CSS.
 * The default theme emits an empty string so a plain site ships no style
 * element at all.
 *
 * The font needs its own rule: `font-serif` utilities inline
 * `var(--font-instrument-serif)`, and next/font sets that variable from a
 * class on <html>. `:root:root` outranks that class without depending on
 * stylesheet order, and the editor's preview rewrites it to its own scope.
 */
export function themeToCss(theme: SiteTheme): string {
	const declarations: string[] = [];
	const preset = findPreset(theme.preset);
	const merged: Partial<Record<TokenName, string>> = { ...preset.tokens };
	for (const name of TOKEN_NAMES) {
		const value = theme.tokens?.[name];
		if (isHexColor(value)) merged[name] = normalizeHex(value);
	}
	for (const name of TOKEN_NAMES) {
		const value = merged[name];
		if (value) declarations.push(`--ma-${name}:${value}`);
	}
	if (theme.texture === false) {
		declarations.push("--ma-plaster-surface:none", "--ma-bronze-surface:none");
	}

	const parts: string[] = [];
	if (declarations.length > 0) parts.push(`:root{${declarations.join(";")}}`);

	const stack = theme.font ? FONT_STACKS[theme.font] : null;
	if (stack) {
		parts.push(
			`:root:root{--font-serif:${stack};--font-instrument-serif:${stack}}`,
		);
	}

	const custom = theme.customCss ? sanitizeCustomCss(theme.customCss) : "";
	if (custom) parts.push(custom);

	return parts.join("\n");
}

/** Relative luminance per WCAG 2.x, for a `#rrggbb` or `#rgb` colour. */
export function relativeLuminance(hex: string) {
	const full = normalizeHex(hex);
	const [r, g, b] = [1, 3, 5]
		.map((start) => Number.parseInt(full.slice(start, start + 2), 16) / 255)
		.map((channel) =>
			channel <= 0.04045 ? channel / 12.92 : ((channel + 0.055) / 1.055) ** 2.4,
		);
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** WCAG contrast ratio between two colours, 1 to 21. */
export function contrastRatio(a: string, b: string) {
	const [lighter, darker] = [relativeLuminance(a), relativeLuminance(b)].sort(
		(x, y) => y - x,
	);
	return (lighter + 0.05) / (darker + 0.05);
}

export const AA_CONTRAST = 4.5;

/** The pairings that carry text in the interface; every preset must clear AA on them. */
export const CONTRAST_PAIRS: readonly [TokenName, TokenName, string][] = [
	["ink", "plaster", "tekst na tle"],
	["pine", "plaster", "tekst pomocniczy na tle"],
	["plaster-lit", "ink", "napis na przycisku"],
];

/** Pairings of a resolved palette that fall under AA, for the editor to flag. */
export function contrastIssues(tokens: Record<TokenName, string>) {
	return CONTRAST_PAIRS.flatMap(([fg, bg, label]) => {
		const ratio = contrastRatio(tokens[fg], tokens[bg]);
		return ratio < AA_CONTRAST ? [{ fg, bg, label, ratio }] : [];
	});
}
