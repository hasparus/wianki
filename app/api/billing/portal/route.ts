import { z } from "zod";
import { requireOwnedSite } from "@/lib/accounts";
import { denyOwnerRequest } from "@/lib/auth/session";
import { stripeClient } from "@/lib/billing/stripe";
import { billingConfigured, platformOrigin } from "@/lib/env";
import { jsonError, noStoreJson } from "@/lib/http";

const bodySchema = z.object({ siteId: z.string().min(1).max(64) });

/** Opens the Stripe billing portal for the site's customer. */
export async function POST(request: Request) {
	const origin = platformOrigin();
	const guard = await denyOwnerRequest(request, origin);
	if ("response" in guard) return guard.response;
	if (!billingConfigured()) {
		return jsonError("Płatności nie są skonfigurowane na tym wdrożeniu.", 409);
	}
	const parsed = bodySchema.safeParse(await request.json().catch(() => null));
	if (!parsed.success) return jsonError("Wskaż galerię.", 400);

	const site = await requireOwnedSite(
		parsed.data.siteId,
		guard.session.accountId,
	);
	if (!site) return jsonError("Nie znaleziono galerii.", 404);
	if (!site.stripe_customer_id) {
		return jsonError("Ta galeria nie ma jeszcze żadnej płatności.", 409);
	}
	try {
		const session = await stripeClient().billingPortal.sessions.create({
			customer: site.stripe_customer_id,
			return_url: `${origin}/konto/strony/${encodeURIComponent(site.id)}`,
			locale: "pl",
		});
		return noStoreJson({ url: session.url });
	} catch (error) {
		console.error(
			"[billing] nie udało się otworzyć portalu płatności:",
			error instanceof Error ? error.message : error,
		);
		return jsonError("Nie udało się otworzyć portalu płatności.", 502);
	}
}
