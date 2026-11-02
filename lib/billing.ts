import { billingConfigured } from "@/lib/env";

/**
 * Hook called after every change to what a site stores. The billing module
 * turns the site's archive usage into Stripe meter events; without Stripe
 * configured (self-hosted deployments, local dev) there is nothing to do.
 */
export async function syncStorageUsage(siteId: string): Promise<void> {
	if (!billingConfigured()) return;
	const { reportStorageOverage } = await import("@/lib/billing/stripe");
	await reportStorageOverage(siteId);
}
