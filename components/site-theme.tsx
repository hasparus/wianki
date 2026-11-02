import { parseTheme, themeToCss } from "@/lib/theme";

/**
 * A site's theme as one style element in <head>. The default world emits
 * nothing, so an untouched site renders exactly app/globals.css; parsing is
 * lenient, so a damaged theme_json falls back to that same default.
 */
export function SiteTheme({ themeJson }: { themeJson: string }) {
	const css = themeToCss(parseTheme(themeJson));
	if (!css) return null;
	// biome-ignore lint/security/noDangerouslySetInnerHtml: themeToCss emits validated tokens and sanitized CSS only.
	return <style id="site-theme" dangerouslySetInnerHTML={{ __html: css }} />;
}
