import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
	title: "Paweł & Magdalena — galeria zdjęć",
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
		<html lang="pl" className="h-full antialiased">
			<body className="flex min-h-full flex-col">{children}</body>
		</html>
	);
}
