import type { Metadata } from "next";
import localFont from "next/font/local";
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

export const metadata: Metadata = {
	title: "Rosia & Piotrek — galeria zdjęć",
	description: "Prywatna galeria zdjęć ślubnych dla naszych gości.",
	robots: {
		index: false,
		follow: false,
		nocache: true,
	},
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="pl"
			className={`${instrumentSerif.variable} h-full antialiased`}
		>
			<body className="flex min-h-full flex-col">{children}</body>
		</html>
	);
}
