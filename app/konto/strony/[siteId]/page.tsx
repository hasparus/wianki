import { notFound } from "next/navigation";
import QRCode from "qrcode";
import {
	entryLinks,
	publicSiteSettings,
	requireOwnedSite,
} from "@/lib/accounts";
import { requireOwner } from "@/lib/auth/session";
import { planSummary } from "@/lib/billing/stripe";
import { TRIAL_PHOTO_LIMIT } from "@/lib/domain";
import { billingConfigured, moderationConfigured, serverEnv } from "@/lib/env";
import { getSiteUsage } from "@/lib/usage";
import { SiteSettings } from "./site-settings";

export const dynamic = "force-dynamic";

/** Same drawing as the slideshow's corner QR: ink on lit plaster. */
function qr(url: string) {
	return QRCode.toDataURL(url, {
		width: 240,
		margin: 1,
		errorCorrectionLevel: "M",
		color: { dark: "#1a1a1a", light: "#f7f7f7" },
	});
}

export default async function SitePage({
	params,
	searchParams,
}: {
	params: Promise<{ siteId: string }>;
	searchParams: Promise<{ billing?: string }>;
}) {
	const session = await requireOwner();
	const [{ siteId }, { billing }] = await Promise.all([params, searchParams]);
	const site = await requireOwnedSite(siteId, session.accountId);
	if (!site) notFound();

	const links = entryLinks(site);
	const [usage, guestQr, adminQr] = await Promise.all([
		getSiteUsage(site.id),
		qr(links.guestUrl),
		qr(links.adminUrl),
	]);
	const env = serverEnv();

	return (
		<SiteSettings
			site={publicSiteSettings(site)}
			links={{ ...links, guestQr, adminQr }}
			plan={planSummary(site, usage)}
			trialPhotoLimit={TRIAL_PHOTO_LIMIT}
			moderationAvailable={moderationConfigured(env)}
			billingAvailable={billingConfigured(env)}
			billingNotice={
				billing === "success" || billing === "canceled" ? billing : null
			}
			platformHost={env.PLATFORM_HOST}
		/>
	);
}
