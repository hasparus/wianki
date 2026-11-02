import Stripe from "stripe";
import { nowIso, run } from "@/lib/db";
import { INCLUDED_ARCHIVE_BYTES, OVERAGE_BLOCK_BYTES } from "@/lib/domain";
import { serverEnv } from "@/lib/env";
import { findSiteById, type Site } from "@/lib/sites";
import { getSiteUsage, type SiteUsage } from "@/lib/usage";

/**
 * Pricing, in one place: a yearly licence per site with a bundle of
 * originals, then metered blocks above it. The meter takes the current
 * number of blocks (`last` aggregation), so the app reports the whole figure
 * whenever usage changes and Stripe bills it at the end of the period.
 */
export const YEARLY_PRICE_USD = 49;
export const OVERAGE_BLOCK_PRICE_USD = 5;
export const STORAGE_METER_EVENT = "wianki_storage_overage_blocks";

const GIB = 1024 * 1024 * 1024;

let client: Stripe | undefined;
let clientKey: string | undefined;

/** One Stripe client per secret, on the fetch transport so it runs on Workers. */
export function stripeClient(): Stripe {
	const key = serverEnv().STRIPE_SECRET_KEY;
	if (!key)
		throw new Error("Płatności nie są skonfigurowane na tym wdrożeniu.");
	if (!client || clientKey !== key) {
		client = new Stripe(key, { httpClient: Stripe.createFetchHttpClient() });
		clientKey = key;
	}
	return client;
}

/**
 * Stripe's subscription vocabulary folded into the site's four states.
 * Null means "no opinion": `incomplete` and `paused` leave the row as it is.
 */
export function planStatusFromStripe(
	status: Stripe.Subscription.Status,
): Site["plan_status"] | null {
	switch (status) {
		case "active":
		case "trialing":
			return "active";
		case "past_due":
		case "unpaid":
			return "past_due";
		case "canceled":
		case "incomplete_expired":
			return "canceled";
		default:
			return null;
	}
}

/**
 * Since the 2025-03-31 API the period lives on each subscription item; the
 * latest one is the subscription's. Null when Stripe sent no items.
 */
export function periodEndFromSubscription(
	subscription: Pick<Stripe.Subscription, "items">,
): string | null {
	const ends = (subscription.items?.data ?? [])
		.map((item) => item.current_period_end)
		.filter((value): value is number => typeof value === "number");
	if (ends.length === 0) return null;
	return new Date(Math.max(...ends) * 1000).toISOString();
}

/** Whole 10 GB blocks above what the plan includes; never negative. */
export function overageBlocks(
	archiveBytes: number,
	includedBytes: number = INCLUDED_ARCHIVE_BYTES,
) {
	const over = archiveBytes - includedBytes;
	if (over <= 0) return 0;
	return Math.ceil(over / OVERAGE_BLOCK_BYTES);
}

export type PlanSummary = {
	status: Site["plan_status"];
	photoCount: number;
	archiveBytes: number;
	includedBytes: number;
	/** Used originals, in GB, to one decimal. */
	usedGb: number;
	includedGb: number;
	blocks: number;
	/** What the blocks add to the yearly bill, in USD. */
	extraYearlyUsd: number;
	yearlyUsd: number;
	currentPeriodEnd: string | null;
	hasCustomer: boolean;
};

function toGb(bytes: number) {
	return Math.round((bytes / GIB) * 10) / 10;
}

export function planSummary(
	site: Pick<
		Site,
		| "plan_status"
		| "included_archive_bytes"
		| "current_period_end"
		| "stripe_customer_id"
	>,
	usage: SiteUsage,
): PlanSummary {
	const blocks = overageBlocks(usage.archiveBytes, site.included_archive_bytes);
	return {
		status: site.plan_status,
		photoCount: usage.photoCount,
		archiveBytes: usage.archiveBytes,
		includedBytes: site.included_archive_bytes,
		usedGb: toGb(usage.archiveBytes),
		includedGb: toGb(site.included_archive_bytes),
		blocks,
		extraYearlyUsd: blocks * OVERAGE_BLOCK_PRICE_USD,
		yearlyUsd: YEARLY_PRICE_USD,
		currentPeriodEnd: site.current_period_end,
		hasCustomer: Boolean(site.stripe_customer_id),
	};
}

/**
 * Called after anything that changes what a site stores. Sends the current
 * block count to the meter only when it differs from what was last reported
 * and the site has a Stripe customer. Never throws: billing lag must not
 * fail an upload or a deletion, so problems are logged and the next change
 * retries.
 */
export async function reportStorageOverage(siteId: string): Promise<void> {
	try {
		const site = await findSiteById(siteId);
		if (!site?.stripe_customer_id) return;
		const usage = await getSiteUsage(siteId);
		const blocks = overageBlocks(
			usage.archiveBytes,
			site.included_archive_bytes,
		);
		if (blocks === site.overage_blocks_reported) return;
		await stripeClient().billing.meterEvents.create({
			event_name: STORAGE_METER_EVENT,
			payload: {
				stripe_customer_id: site.stripe_customer_id,
				value: String(blocks),
			},
		});
		await run(
			"update sites set overage_blocks_reported = ?, updated_at = ? where id = ?",
			[blocks, nowIso(), siteId],
		);
	} catch (error) {
		console.error(
			`[billing] nie udało się zgłosić zużycia dla strony ${siteId}:`,
			error instanceof Error ? error.message : error,
		);
	}
}
