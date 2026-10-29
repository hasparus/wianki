import type { Metadata } from "next";
import localFont from "next/font/local";
import { SiteTheme } from "@/components/site-theme";
import { currentSite } from "@/lib/sites";
import "./globals.css";

/**
 * Instrument Serif is vendored under public/fonts so a clean checkout builds
 * with no network access to a font provider. Both Latin subsets ship: Polish
 * needs latin-ext for ą ć ę ł ń ó ś ź ż. Upright only — the world sets no
 * italic.
 */
const instrumentSerif = localFont({
	src: [
		{
			path: "../public/fonts/instrument-serif-latin.woff2",
			weight: "400",
			style: "normal",
		},
		{
			path: "../public/fonts/instrument-serif-latin-ext.woff2",
			weight: "400",
			style: "normal",
		},
	],
	variable: "--font-instrument-serif",
	display: "swap",
	fallback: ["Iowan Old Style", "Georgia", "serif"],
});

async function safeCurrentSite() {
	try {
		return await currentSite();
	} catch {
		return null;
	}
}

export async function generateMetadata(): Promise<Metadata> {
	const site = await safeCurrentSite();
	return {
		title: site ? `${site.title} — galeria zdjęć` : "Wianki — galeria ślubna",
		description: site
			? "Prywatna galeria zdjęć ślubnych dla naszych gości."
			: "Prywatna galeria zdjęć dla gości wesela, bez kont i bez e-maili.",
		robots: {
			index: false,
			follow: false,
			nocache: true,
		},
	};
}

export default async function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	const site = await safeCurrentSite();
	return (
		<html
			lang="pl"
			className={`${instrumentSerif.variable} h-full antialiased`}
		>
			<head>{site ? <SiteTheme themeJson={site.theme_json} /> : null}</head>
			<body className="flex min-h-full flex-col">{children}</body>
		</html>
	);
}
