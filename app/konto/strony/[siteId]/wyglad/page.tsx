import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireOwner } from "@/lib/auth/session";
import { first } from "@/lib/db";
import { SITE_COLUMNS, type SiteRow, toSite } from "@/lib/sites";
import { parseTheme } from "@/lib/theme";
import { ThemeEditor } from "./theme-editor";

export const metadata: Metadata = {
	title: "Wygląd galerii",
};

export default async function SiteThemePage({
	params,
}: {
	params: Promise<{ siteId: string }>;
}) {
	const session = await requireOwner();
	const { siteId } = await params;
	// Ownership is part of the lookup: another account's site is a 404, not a 403.
	const row = await first<SiteRow>(
		`select ${SITE_COLUMNS} from sites where id = ? and account_id = ?`,
		[siteId, session.accountId],
	);
	if (!row) notFound();
	const site = toSite(row);
	return (
		<ThemeEditor
			siteId={site.id}
			siteTitle={site.title}
			siteOrigin={site.origin}
			initialTheme={parseTheme(site.theme_json)}
		/>
	);
}
