import { z } from "zod";
import { findAccountById, requireOwnedSite } from "@/lib/accounts";
import { denyOwnerRequest } from "@/lib/auth/session";
import { stripeClient } from "@/lib/billing/stripe";
import { billingConfigured, platformOrigin, serverEnv } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";

const bodySchema = z.object({ siteId: z.string().min(1).max(64) });

/**
 * Starts a Stripe Checkout for one site: the yearly licence plus the
 * metered storage price on one subscription. The site id travels as
 * client_reference_id and metadata so the webhook can find the row again.
 */
export async function POST(request: Request) {
	const origin = platformOrigin();
	const guard = await denyOwnerRequest(request, origin);
	if ("response" in guard) return guard.response;
	if (!billingConfigured()) {
		return jsonError("Płatności nie są skonfigurowane na tym wdrożeniu.", 409);
	}
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Wskaż galerię do opłacenia.", 400);

	const site = await requireOwnedSite(
		parsed.data.siteId,
		guard.session.accountId,
	);
	if (!site) return jsonError("Nie znaleziono galerii.", 404);
	if (site.plan_status === "active" && site.stripe_subscription_id) {
		return jsonError(
			"Ta galeria jest już opłacona. Płatnością zarządzasz w portalu.",
			409,
		);
	}
	const account = await findAccountById(guard.session.accountId);
	if (!account) return jsonError("Brak dostępu.", 401);

	const env = serverEnv();
	const sitePage = `${origin}/konto/strony/${encodeURIComponent(site.id)}`;
	try {
		const session = await stripeClient().checkout.sessions.create({
			mode: "subscription",
			line_items: [
				{ price: env.STRIPE_PRICE_YEARLY as string, quantity: 1 },
				{ price: env.STRIPE_PRICE_OVERAGE as string },
			],
			...(site.stripe_customer_id
				? { customer: site.stripe_customer_id }
				: { customer_email: account.email }),
			client_reference_id: site.id,
			metadata: { siteId: site.id },
			subscription_data: { metadata: { siteId: site.id } },
			success_url: `${sitePage}?billing=success`,
			cancel_url: `${sitePage}?billing=canceled`,
			locale: "pl",
		});
		if (!session.url) throw new Error("Stripe nie zwrócił adresu płatności.");
		return noStoreJson({ url: session.url });
	} catch (error) {
		console.error(
			"[billing] nie udało się rozpocząć płatności:",
			error instanceof Error ? error.message : error,
		);
		return jsonError("Nie udało się rozpocząć płatności.", 502);
	}
}
