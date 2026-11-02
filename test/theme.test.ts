import { readFileSync } from "node:fs";
import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	readOwnerSession: vi.fn(),
}));

vi.mock("@/lib/auth/session", async (importOriginal) => ({
	...(await importOriginal<typeof import("@/lib/auth/session")>()),
	readOwnerSession: mocks.readOwnerSession,
}));

import { PUT as putTheme } from "@/app/api/konto/sites/[siteId]/theme/route";
import { first, run } from "@/lib/db";
import {
	AA_CONTRAST,
	CONTRAST_PAIRS,
	contrastRatio,
	DEFAULT_TOKENS,
	defaultTheme,
	PRESETS,
	parseTheme,
	sanitizeCustomCss,
	TOKEN_NAMES,
	themeSchema,
	themeToCss,
} from "@/lib/theme";
import { setupSite } from "./helpers/site";

describe("parseTheme", () => {
	it("falls back to the default theme on broken or foreign JSON", () => {
		expect(parseTheme("{")).toEqual({});
		expect(parseTheme("")).toEqual({});
		expect(parseTheme(null)).toEqual({});
		expect(parseTheme("[1,2]")).toEqual({});
		expect(parseTheme('"string"')).toEqual({});
		expect(parseTheme("42")).toEqual({});
	});

	it("keeps valid fields and drops invalid ones instead of throwing", () => {
		const theme = parseTheme(
			JSON.stringify({
				preset: "nope",
				tokens: {
					ink: "#223",
					plaster: "url(https://evil.example/x.png)",
					pine: "red",
					unknown: "#000000",
				},
				font: "comic-sans",
				texture: "no",
				customCss: 12,
				extra: true,
			}),
		);
		expect(theme).toEqual({ tokens: { ink: "#222233" } });
	});

	it("keeps a full valid theme, clamping the custom CSS", () => {
		const theme = parseTheme(
			JSON.stringify({
				preset: "noc",
				tokens: { ink: "#FFFFFF" },
				font: "system-sans",
				texture: false,
				customCss: "x".repeat(30_000),
			}),
		);
		expect(theme.preset).toBe("noc");
		expect(theme.tokens).toEqual({ ink: "#ffffff" });
		expect(theme.font).toBe("system-sans");
		expect(theme.texture).toBe(false);
		expect(theme.customCss?.length).toBe(20_000);
	});
});

describe("themeSchema", () => {
	it("rejects token values that are not hex colours", () => {
		for (const value of [
			"url(https://evil.example/x.png)",
			"red",
			"#12345",
			"#ggg",
			"1a1a1a",
			"#1a1a1a; background: red",
		]) {
			expect(themeSchema.safeParse({ tokens: { ink: value } }).success).toBe(
				false,
			);
		}
		expect(themeSchema.safeParse({ tokens: { ink: "#1A1A1A" } }).success).toBe(
			true,
		);
		expect(themeSchema.safeParse({ tokens: { ink: "#abc" } }).data).toEqual({
			tokens: { ink: "#aabbcc" },
		});
	});

	it("rejects unknown token names, presets and fonts", () => {
		expect(themeSchema.safeParse({ tokens: { body: "#000" } }).success).toBe(
			false,
		);
		expect(themeSchema.safeParse({ preset: "neon" }).success).toBe(false);
		expect(themeSchema.safeParse({ font: "papyrus" }).success).toBe(false);
		expect(
			themeSchema.safeParse({ customCss: "x".repeat(20_001) }).success,
		).toBe(false);
	});
});

describe("sanitizeCustomCss", () => {
	it("removes @import rules", () => {
		const out = sanitizeCustomCss(
			'@import url("https://evil.example/a.css");\n@import "b.css" screen;\n.a{color:red}',
		);
		expect(out).not.toContain("@import");
		expect(out).toContain(".a{color:red}");
	});

	it("cannot close the style element", () => {
		const out = sanitizeCustomCss(
			".a{}</style><script>alert(1)</script></STYLE ><style>",
		);
		expect(out.toLowerCase()).not.toContain("</style");
	});

	it("drops legacy script vectors", () => {
		const out = sanitizeCustomCss(
			".a{width:expression(alert(1));behavior:url(x.htc);-moz-binding:url(y.xml);background:url(javascript:alert(1))}",
		);
		expect(out).not.toMatch(/expression\s*\(/i);
		expect(out).not.toMatch(/behavior\s*:/i);
		expect(out).not.toContain("-moz-binding");
		expect(out).not.toMatch(/javascript\s*:/i);
	});

	it("keeps url() so owners can use their own images", () => {
		const out = sanitizeCustomCss(
			"body{background:url(https://example.com/linen.png)}",
		);
		expect(out).toBe("body{background:url(https://example.com/linen.png)}");
	});

	it("caps the length", () => {
		expect(sanitizeCustomCss("a".repeat(25_000)).length).toBe(20_000);
	});
});

describe("themeToCss", () => {
	it("emits nothing for the default theme and its spelled-out equivalents", () => {
		expect(themeToCss(defaultTheme)).toBe("");
		expect(themeToCss({})).toBe("");
		expect(
			themeToCss({
				preset: "tokonoma",
				font: "instrument-serif",
				texture: true,
				tokens: {},
				customCss: "",
			}),
		).toBe("");
	});

	it("merges preset tokens with per-site overrides, overrides winning", () => {
		const css = themeToCss({ preset: "noc", tokens: { ink: "#fff" } });
		expect(css.startsWith(":root{")).toBe(true);
		expect(css).toContain("--ma-plaster:#0a0a0a");
		expect(css).toContain("--ma-ink:#ffffff");
		expect(css).not.toContain("--ma-ink:#efefef");
		expect(css.match(/--ma-ink:/g)).toHaveLength(1);
	});

	it("ignores token values that are not hex even when handed a raw object", () => {
		const css = themeToCss({
			tokens: {
				ink: "url(https://evil.example/x.png)",
				plaster: "#123",
			} as never,
		});
		expect(css).toBe(":root{--ma-plaster:#112233}");
	});

	it("maps the font choice and the texture switch", () => {
		expect(themeToCss({ font: "system-serif" })).toBe(
			':root:root{--font-serif:"Iowan Old Style", Georgia, serif;--font-instrument-serif:"Iowan Old Style", Georgia, serif}',
		);
		expect(themeToCss({ font: "system-sans" })).toContain(
			"--font-serif:ui-sans-serif, system-ui",
		);
		expect(themeToCss({ texture: false })).toBe(
			":root{--ma-plaster-surface:none;--ma-bronze-surface:none}",
		);
	});

	it("appends sanitized custom CSS last", () => {
		const css = themeToCss({
			tokens: { ink: "#000" },
			customCss: "@import url(x);\n.a{color:red}</style>",
		});
		expect(css).toBe(":root{--ma-ink:#000000}\n.a{color:red}");
	});
});

describe("presets", () => {
	it("mirror the tokonoma defaults from app/globals.css", () => {
		const css = readFileSync("app/globals.css", "utf8");
		for (const name of TOKEN_NAMES) {
			expect(css).toContain(`--ma-${name}: ${DEFAULT_TOKENS[name]};`);
		}
	});

	it("start with the default world and only use known tokens", () => {
		expect(PRESETS[0].id).toBe("tokonoma");
		expect(PRESETS[0].tokens).toEqual({});
		expect(PRESETS.length).toBeGreaterThanOrEqual(5);
		for (const preset of PRESETS) {
			for (const [name, value] of Object.entries(preset.tokens)) {
				expect(TOKEN_NAMES).toContain(name);
				expect(value).toMatch(/^#[0-9a-f]{6}$/);
			}
			expect(preset.name.length).toBeGreaterThan(0);
			expect(preset.description.length).toBeGreaterThan(0);
		}
	});

	it("keep AA contrast on every text pairing", () => {
		for (const preset of PRESETS) {
			const tokens = { ...DEFAULT_TOKENS, ...preset.tokens };
			for (const [fg, bg] of CONTRAST_PAIRS) {
				const ratio = contrastRatio(tokens[fg], tokens[bg]);
				expect({ preset: preset.id, fg, bg, ratio }).toEqual({
					preset: preset.id,
					fg,
					bg,
					ratio: expect.toSatisfy((value: number) => value >= AA_CONTRAST),
				});
			}
		}
	});
});

describe("PUT /api/konto/sites/[siteId]/theme", () => {
	const OTHER_ACCOUNT = "44444444-4444-4444-8444-444444444444";
	const OTHER_SITE = "55555555-5555-4555-8555-555555555555";

	function request(theme: unknown, sameOrigin = true) {
		const headers = new Headers({ "Content-Type": "application/json" });
		if (sameOrigin) headers.set("origin", "https://wianki.test");
		return new Request("https://wianki.test/api/konto/sites/x/theme", {
			method: "PUT",
			headers,
			body: JSON.stringify({ theme }),
		});
	}

	function call(siteId: string, theme: unknown, sameOrigin = true) {
		return putTheme(request(theme, sameOrigin), {
			params: Promise.resolve({ siteId }),
		});
	}

	async function storedTheme(siteId: string) {
		const row = await first<{ theme_json: string }>(
			"select theme_json from sites where id = ?",
			[siteId],
		);
		return row?.theme_json;
	}

	beforeEach(() => {
		vi.clearAllMocks();
	});

	it("rejects a visitor without an owner cookie", async () => {
		mocks.readOwnerSession.mockResolvedValue(null);
		const { site } = await setupSite();
		const response = await call(site.id, { preset: "noc" });
		expect(response.status).toBe(401);
		expect(await storedTheme(site.id)).toBe("{}");
	});

	it("rejects a cross-origin request", async () => {
		const { site, accountId } = await setupSite();
		mocks.readOwnerSession.mockResolvedValue({ role: "owner", accountId });
		const response = await call(site.id, { preset: "noc" }, false);
		expect(response.status).toBe(403);
		expect(await storedTheme(site.id)).toBe("{}");
	});

	it("rejects a site owned by another account as not found", async () => {
		const { accountId } = await setupSite();
		await run("insert into accounts (id, email) values (?, ?)", [
			OTHER_ACCOUNT,
			"other@example.com",
		]);
		await run(
			`insert into sites (id, account_id, slug, title, guest_entry_token, admin_entry_token)
			 values (?, ?, 'inna', 'Inna para', 'guest-token-for-the-other-site-32b', 'admin-token-for-the-other-site-32b')`,
			[OTHER_SITE, OTHER_ACCOUNT],
		);
		mocks.readOwnerSession.mockResolvedValue({ role: "owner", accountId });
		const response = await call(OTHER_SITE, { preset: "noc" });
		expect(response.status).toBe(404);
		expect(await storedTheme(OTHER_SITE)).toBe("{}");
	});

	it("rejects an invalid theme", async () => {
		const { site, accountId } = await setupSite();
		mocks.readOwnerSession.mockResolvedValue({ role: "owner", accountId });
		const response = await call(site.id, { tokens: { ink: "red" } });
		expect(response.status).toBe(400);
		expect(await storedTheme(site.id)).toBe("{}");
	});

	it("stores the parsed theme and returns its CSS", async () => {
		const { site, accountId } = await setupSite();
		mocks.readOwnerSession.mockResolvedValue({ role: "owner", accountId });
		const response = await call(site.id, {
			preset: "noc",
			tokens: { ink: "#FFF" },
			texture: false,
			customCss: "@import url(x); .a{color:red}",
			junk: "dropped",
		});
		expect(response.status).toBe(200);
		expect(response.headers.get("cache-control")).toBe("private, no-store");
		const body = (await response.json()) as { ok: boolean; css: string };
		expect(body.ok).toBe(true);
		expect(body.css).toContain("--ma-plaster:#0a0a0a");
		expect(body.css).toContain("--ma-ink:#ffffff");
		expect(body.css).toContain("--ma-plaster-surface:none");
		expect(body.css).toContain(".a{color:red}");
		expect(body.css).not.toContain("@import");

		const stored = JSON.parse((await storedTheme(site.id)) as string);
		expect(stored).toEqual({
			preset: "noc",
			tokens: { ink: "#ffffff" },
			texture: false,
			customCss: "@import url(x); .a{color:red}",
		});
		expect(themeToCss(parseTheme(JSON.stringify(stored)))).toBe(body.css);
	});

	it("resets to the default world with an empty theme", async () => {
		const { site, accountId } = await setupSite();
		mocks.readOwnerSession.mockResolvedValue({ role: "owner", accountId });
		await call(site.id, { preset: "grafit" });
		const response = await call(site.id, {});
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({ ok: true, css: "" });
		expect(await storedTheme(site.id)).toBe("{}");
	});
});
