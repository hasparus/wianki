import type Stripe from "stripe";
import {
	periodEndFromSubscription,
	planStatusFromStripe,
	reportStorageOverage,
	stripeClient,
} from "@/lib/billing/stripe";
import { first, nowIso, run } from "@/lib/db";
import { billingConfigured, serverEnv } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";
import type { Site } from "@/lib/sites";

function stripeId(
	value: string | { id: string } | null | undefined,
): string | null {
	if (!value) return null;
	return typeof value === "string" ? value : value.id;
}

async function findSiteForBilling(keys: {
	subscriptionId?: string | null;
	customerId?: string | null;
	siteId?: string | null;
}): Promise<string | null> {
	if (keys.siteId) {
		const row = await first<{ id: string }>(
			"select id from sites where id = ?",
			[keys.siteId],
		);
		if (row) return row.id;
	}
	if (keys.subscriptionId) {
		const row = await first<{ id: string }>(
			"select id from sites where stripe_subscription_id = ?",
			[keys.subscriptionId],
		);
		if (row) return row.id;
	}
	if (keys.customerId) {
		const row = await first<{ id: string }>(
			"select id from sites where stripe_customer_id = ? order by updated_at desc limit 1",
			[keys.customerId],
		);
		if (row) return row.id;
	}
	return null;
}

async function setPlan(
	siteId: string,
	patch: { status?: Site["plan_status"] | null; periodEnd?: string | null },
) {
	const sets: string[] = ["updated_at = ?"];
	const params: (string | null)[] = [nowIso()];
	if (patch.status) {
		sets.push("plan_status = ?");
		params.push(patch.status);
	}
	if (patch.periodEnd !== undefined) {
		sets.push("current_period_end = ?");
		params.push(patch.periodEnd);
	}
	await run(`update sites set ${sets.join(", ")} where id = ?`, [
		...params,
		siteId,
	]);
}

async function onCheckoutCompleted(session: Stripe.Checkout.Session) {
	const siteId = await findSiteForBilling({
		siteId: session.client_reference_id ?? session.metadata?.siteId,
	});
	if (!siteId) return;
	const customerId = stripeId(session.customer);
	const subscriptionId = stripeId(session.subscription);
	let periodEnd: string | null = null;
	if (subscriptionId) {
		const subscription =
			typeof session.subscription === "object" && session.subscription
				? session.subscription
				: await stripeClient().subscriptions.retrieve(subscriptionId);
		periodEnd = periodEndFromSubscription(subscription);
	}
	await run(
		`update sites set stripe_customer_id = coalesce(?, stripe_customer_id),
		   stripe_subscription_id = coalesce(?, stripe_subscription_id),
		   plan_status = 'active', current_period_end = ?, updated_at = ?
		 where id = ?`,
		[customerId, subscriptionId, periodEnd, nowIso(), siteId],
	);
	// Whatever the site already stores counts from the first paid day.
	await reportStorageOverage(siteId);
}

async function onSubscriptionChanged(
	subscription: Stripe.Subscription,
	forcedStatus?: Site["plan_status"],
) {
	const siteId = await findSiteForBilling({
		subscriptionId: subscription.id,
		siteId: subscription.metadata?.siteId,
		customerId: stripeId(subscription.customer),
	});
	if (!siteId) return;
	await setPlan(siteId, {
		status: forcedStatus ?? planStatusFromStripe(subscription.status),
		periodEnd: periodEndFromSubscription(subscription),
	});
}

async function onPaymentFailed(invoice: Stripe.Invoice) {
	const siteId = await findSiteForBilling({
		subscriptionId: stripeId(
			invoice.parent?.subscription_details?.subscription,
		),
		customerId: stripeId(invoice.customer),
	});
	if (!siteId) return;
	await setPlan(siteId, { status: "past_due" });
}

async function applyEvent(event: Stripe.Event) {
	switch (event.type) {
		case "checkout.session.completed":
			return onCheckoutCompleted(event.data.object);
		case "customer.subscription.updated":
			return onSubscriptionChanged(event.data.object);
		case "customer.subscription.deleted":
			return onSubscriptionChanged(event.data.object, "canceled");
		case "invoice.payment_failed":
			return onPaymentFailed(event.data.object);
		default:
			return;
	}
}

/**
 * Stripe's webhook. Public by design and authorized by the signature alone,
 * verified with Web Crypto so it runs on Workers. Every event id is recorded
 * before it is applied, so a redelivery is a no-op; a failure to apply
 * forgets the id again and answers 500 so Stripe retries.
 */
export async function POST(request: Request) {
	const env = serverEnv();
	if (!billingConfigured(env) || !env.STRIPE_WEBHOOK_SECRET) {
		return jsonError("Płatności nie są skonfigurowane na tym wdrożeniu.", 503);
	}
	const signature = request.headers.get("stripe-signature");
	if (!signature) return jsonError("Brak podpisu Stripe.", 400);
	const payload = await request.text();

	let event: Stripe.Event;
	try {
		event = await stripeClient().webhooks.constructEventAsync(
			payload,
			signature,
			env.STRIPE_WEBHOOK_SECRET,
		);
	} catch {
		return jsonError("Nieprawidłowy podpis Stripe.", 400);
	}

	const inserted = await run(
		"insert into billing_events (id, type) values (?, ?) on conflict (id) do nothing",
		[event.id, event.type],
	);
	if (inserted === 0) return noStoreJson({ received: true, duplicate: true });

	try {
		await applyEvent(event);
	} catch (error) {
		await run("delete from billing_events where id = ?", [event.id]).catch(
			() => {},
		);
		console.error(
			`[billing] nie udało się przetworzyć zdarzenia ${event.type}:`,
			error instanceof Error ? error.message : error,
		);
		return jsonError("Nie udało się przetworzyć zdarzenia.", 500);
	}
	return noStoreJson({ received: true });
}
