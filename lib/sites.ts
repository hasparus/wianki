import { headers } from "next/headers";
import { notFound } from "next/navigation";
import { cache } from "react";
import { first, nowIso, run } from "@/lib/db";
import { platformScheme, type ServerEnv, serverEnv } from "@/lib/env";

/**
 * A site is one wedding: its own subdomain, secrets, theme and plan. Rows
 * come straight from D1; the few derived fields are computed here so pages
 * and handlers never read `theme_json` or `moderation_enabled` raw.
 */
export type SiteRow = {
	id: string;
	account_id: string;
	slug: string;
	custom_domain: string | null;
	title: string;
	event_date: string | null;
	guest_passphrase_hash: string | null;
	admin_passphrase_hash: string | null;
	guest_entry_token: string;
	admin_entry_token: string;
	guest_join_code: string | null;
	guest_open_until: string | null;
	session_key_version: number;
	moderation_enabled: number;
	deletion_contact_email: string | null;
	consent_version: string;
	theme_json: string;
	plan_status: "trial" | "active" | "past_due" | "canceled";
	stripe_customer_id: string | null;
	stripe_subscription_id: string | null;
	current_period_end: string | null;
	included_archive_bytes: number;
	overage_blocks_reported: number;
	created_at: string;
	updated_at: string;
};

export type Site = SiteRow & {
	moderationEnabled: boolean;
	/** Canonical origin of the site, scheme included, no trailing slash. */
	origin: string;
};

export const SITE_COLUMNS = `id, account_id, slug, custom_domain, title, event_date,
	guest_passphrase_hash, admin_passphrase_hash, guest_entry_token, admin_entry_token,
	guest_join_code, guest_open_until, session_key_version, moderation_enabled,
	deletion_contact_email, consent_version, theme_json, plan_status,
	stripe_customer_id, stripe_subscription_id, current_period_end,
	included_archive_bytes, overage_blocks_reported, created_at, updated_at`;

export function siteHost(
	site: Pick<SiteRow, "slug" | "custom_domain">,
	env: ServerEnv = serverEnv(),
) {
	return site.custom_domain ?? `${site.slug}.${env.PLATFORM_HOST}`;
}

export function siteOrigin(
	site: Pick<SiteRow, "slug" | "custom_domain">,
	env: ServerEnv = serverEnv(),
) {
	const host = siteHost(site, env);
	return `${platformScheme(host)}://${host}`;
}

export function toSite(row: SiteRow, env: ServerEnv = serverEnv()): Site {
	return {
		...row,
		moderationEnabled: row.moderation_enabled === 1,
		origin: siteOrigin(row, env),
	};
}

export type HostTarget =
	| { kind: "platform" }
	| { kind: "slug"; slug: string }
	| { kind: "domain"; domain: string };

/**
 * Which site a Host header points at. `wianki.app` is the owner console,
 * `rosia.wianki.app` is a site by slug, anything else is a custom domain.
 * Ports are ignored so `rosia.localhost:3000` works in development.
 */
export function targetFromHost(
	hostHeader: string | null,
	platformHost: string,
): HostTarget {
	const host = (hostHeader ?? "").toLowerCase().split(":")[0];
	const platform = platformHost.toLowerCase().split(":")[0];
	if (!host || host === platform) return { kind: "platform" };
	if (host.endsWith(`.${platform}`)) {
		const slug = host.slice(0, -platform.length - 1);
		if (slug.includes(".")) return { kind: "platform" };
		return { kind: "slug", slug };
	}
	return { kind: "domain", domain: host };
}

export async function findSiteById(id: string): Promise<Site | null> {
	const row = await first<SiteRow>(
		`select ${SITE_COLUMNS} from sites where id = ?`,
		[id],
	);
	return row ? toSite(row) : null;
}

export async function findSiteBySlug(slug: string): Promise<Site | null> {
	const row = await first<SiteRow>(
		`select ${SITE_COLUMNS} from sites where slug = ?`,
		[slug],
	);
	return row ? toSite(row) : null;
}

export async function findSiteByDomain(domain: string): Promise<Site | null> {
	const row = await first<SiteRow>(
		`select ${SITE_COLUMNS} from sites where custom_domain = ?`,
		[domain],
	);
	return row ? toSite(row) : null;
}

export async function resolveSite(target: HostTarget): Promise<Site | null> {
	if (target.kind === "slug") return findSiteBySlug(target.slug);
	if (target.kind === "domain") return findSiteByDomain(target.domain);
	return null;
}

/** The site behind the current request, or null on the platform host. */
export const currentSite = cache(async (): Promise<Site | null> => {
	const host = (await headers()).get("host");
	return resolveSite(targetFromHost(host, serverEnv().PLATFORM_HOST));
});

/** Pages on a site host: 404 when the host names no site. */
export async function requireSite(): Promise<Site> {
	const site = await currentSite();
	if (!site) notFound();
	return site;
}

export async function siteFromRequest(request: Request): Promise<Site | null> {
	return resolveSite(
		targetFromHost(request.headers.get("host"), serverEnv().PLATFORM_HOST),
	);
}

/** True while the open house is on: first visits get a session without a passphrase. */
export function openHouseActive(
	site: Pick<SiteRow, "guest_open_until">,
	now = Date.now(),
) {
	return Boolean(
		site.guest_open_until && now < Date.parse(site.guest_open_until),
	);
}

/** Every guest and admin cookie of the site stops verifying. */
export async function rotateSiteSessions(siteId: string) {
	await run(
		"update sites set session_key_version = session_key_version + 1, updated_at = ? where id = ?",
		[nowIso(), siteId],
	);
}

/** A site may accept uploads while on trial or paid up; canceled sites are read-only. */
export function siteAcceptsUploads(site: Pick<SiteRow, "plan_status">) {
	return site.plan_status === "trial" || site.plan_status === "active";
}
