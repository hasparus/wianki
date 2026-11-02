import Link from "next/link";
import { readOwnerSession } from "@/lib/auth/session";

/**
 * The owner console's shell: one line of chrome above the page and the
 * bronze base beneath it. The logout control only exists for a signed-in
 * owner, so the login page under the same shell shows none.
 */
export default async function KontoLayout({
	children,
}: Readonly<{ children: React.ReactNode }>) {
	const session = await readOwnerSession();
	return (
		<>
			<header className="w-full px-5 sm:px-10 lg:px-16">
				<div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-6 border-b border-ma-ash py-5">
					<Link
						href="/konto"
						className="ma-label text-ma-ink underline-offset-4 hover:underline"
					>
						Wianki · konto
					</Link>
					{session ? (
						<form method="post" action="/api/auth/owner/logout">
							<button type="submit" className="ma-action ma-action--quiet">
								Wyloguj
							</button>
						</form>
					) : null}
				</div>
			</header>
			{children}
			<div className="ma-base" aria-hidden />
		</>
	);
}
