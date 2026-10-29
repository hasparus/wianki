import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
	get: vi.fn(),
	constructEventAsync: vi.fn(),
	retrieveSubscription: vi.fn(),
	meterEventCreate: vi.fn(),
	checkoutCreate: vi.fn(),
	portalCreate: vi.fn(),
	constructed: [] as string[],
}));

vi.mock("next/headers", () => ({
	cookies: async () => ({ get: mocks.get }),
	headers: async () => new Headers(),
}));

vi.mock("stripe", () => {
	class Stripe {
		static createFetchHttpClient = () => ({ fetch: true });
		webhooks = { constructEventAsync: mocks.constructEventAsync };
		subscriptions = { retrieve: mocks.retrieveSubscription };
		billing = { meterEvents: { create: mocks.meterEventCreate } };
		checkout = { sessions: { create: mocks.checkoutCreate } };
		billingPortal = { sessions: { create: mocks.portalCreate } };
		constructor(key: string) {
			mocks.constructed.push(key);
		}
	}
	return { default: Stripe };
});

import { POST as checkout } from "@/app/api/billing/checkout/route";
import { POST as portal } from "@/app/api/billing/portal/route";
import { POST as webhook } from "@/app/api/billing/webhook/route";
import { createOwnerSession, OWNER_COOKIE } from "@/lib/auth/session";
import { syncStorageUsage } from "@/lib/billing";
import {
	overageBlocks,
	periodEndFromSubscription,
	planStatusFromStripe,
	planSummary,
	reportStorageOverage,
} from "@/lib/billing/stripe";
import { all, run } from "@/lib/db";
import { INCLUDED_ARCHIVE_BYTES, OVERAGE_BLOCK_BYTES } from "@/lib/domain";
import { findSiteById } from "@/lib/sites";
import { insertPhoto, setupSite } from "./helpers/site";

const ORIGIN = "https://wianki.test";
const STRIPE_ENV = {
	STRIPE_SECRET_KEY: "sk_test_123",
	STRIPE_WEBHOOK_SECRET: "whsec_123",
	STRIPE_PRICE_YEARLY: "price_yearly",
	STRIPE_PRICE_OVERAGE: "price_overage",
};
const GIB = 1024 * 1024 * 1024;

function platformRequest(
	path: string,
	init: RequestInit & { sameOrigin?: boolean; json?: unknown } = {},
) {
	const headers = new Headers(init.headers);
	headers.set("host", "wianki.test");
	if (init.sameOrigin !== false) headers.set("origin", ORIGIN);
	let body = init.body;
	if (init.json !== undefined) {
		headers.set("content-type", "application/json");
		body = JSON.stringify(init.json);
	}
	return new Request(`${ORIGIN}${path}`, { ...init, headers, body });
}

async function signInAs(accountId: string) {
	const jwt = await createOwnerSession(accountId);
	mocks.get.mockImplementation((name: string) =>
		name === OWNER_COOKIE ? { value: jwt } : undefined,
	);
}

function stripeEvent(id: string, type: string, object: unknown) {
	return { id, type, data: { object } };
}

function webhookRequest(body: unknown, signature = "t=1,v1=ok") {
	return new Request(`${ORIGIN}/api/billing/webhook`, {
		method: "POST",
		headers: { "stripe-signature": signature, host: "wianki.test" },
		body: JSON.stringify(body),
	});
}

/** The mocked verifier hands back whatever JSON the request carried. */
function trustPayload() {
	mocks.constructEventAsync.mockImplementation(
		async (payload: string, signature: string, secret: string) => {
			if (secret !== "whsec_123" || signature !== "t=1,v1=ok")
				throw new Error("bad signature");
			return JSON.parse(payload);
		},
	);
}

beforeEach(() => {
	vi.clearAllMocks();
	mocks.constructed.length = 0;
	mocks.get.mockReturnValue(undefined);
});

describe("overageBlocks", () => {
	it("counts whole blocks above the included bundle", () => {
		expect(overageBlocks(0)).toBe(0);
		expect(overageBlocks(INCLUDED_ARCHIVE_BYTES - 1)).toBe(0);
		expect(overageBlocks(INCLUDED_ARCHIVE_BYTES)).toBe(0);
		expect(overageBlocks(INCLUDED_ARCHIVE_BYTES + 1)).toBe(1);
		expect(overageBlocks(INCLUDED_ARCHIVE_BYTES + OVERAGE_BLOCK_BYTES)).toBe(1);
		expect(
			overageBlocks(INCLUDED_ARCHIVE_BYTES + OVERAGE_BLOCK_BYTES + 1),
		).toBe(2);
		expect(overageBlocks(5 * GIB, 2 * GIB)).toBe(1);
		expect(overageBlocks(1, 0)).toBe(1);
	});

	it("summarises the plan for the dashboard", () => {
		const summary = planSummary(
			{
				plan_status: "active",
				included_archive_bytes: INCLUDED_ARCHIVE_BYTES,
				current_period_end: "2027-01-01T00:00:00.000Z",
				stripe_customer_id: "cus_1",
			},
			{ archiveBytes: 25.5 * GIB, derivativeBytes: 0, photoCount: 1200 },
		);
		expect(summary).toMatchObject({
			status: "active",
			includedGb: 10,
			usedGb: 25.5,
			blocks: 2,
			extraYearlyUsd: 10,
			yearlyUsd: 49,
			photoCount: 1200,
			hasCustomer: true,
		});
	});

	it("maps Stripe statuses and reads the period end from items", () => {
		expect(planStatusFromStripe("active")).toBe("active");
		expect(planStatusFromStripe("trialing")).toBe("active");
		expect(planStatusFromStripe("past_due")).toBe("past_due");
		expect(planStatusFromStripe("unpaid")).toBe("past_due");
		expect(planStatusFromStripe("canceled")).toBe("canceled");
		expect(planStatusFromStripe("incomplete_expired")).toBe("canceled");
		expect(planStatusFromStripe("incomplete")).toBeNull();
		expect(planStatusFromStripe("paused")).toBeNull();
		expect(
			periodEndFromSubscription({
				items: {
					data: [
						{ current_period_end: 1_800_000_000 },
						{ current_period_end: 1_800_000_100 },
					],
				},
			} as never),
		).toBe(new Date(1_800_000_100_000).toISOString());
		expect(
			periodEndFromSubscription({ items: { data: [] } } as never),
		).toBeNull();
	});
});

describe("checkout and portal", () => {
	it("refuses with 409 when Stripe is not configured", async () => {
		const { site, accountId } = await setupSite();
		await signInAs(accountId);
		const response = await checkout(
			platformRequest("/api/billing/checkout", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(response.status).toBe(409);
		expect((await response.json()).error).toMatch(/nie są skonfigurowane/);
		expect(mocks.checkoutCreate).not.toHaveBeenCalled();
		expect(mocks.constructed).toEqual([]);
	});

	it("requires an owner cookie and the site's owner", async () => {
		const { site } = await setupSite({}, STRIPE_ENV);
		const anonymous = await checkout(
			platformRequest("/api/billing/checkout", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(anonymous.status).toBe(401);

		await run("insert into accounts (id, email) values (?, ?)", [
			"99999999-9999-4999-8999-999999999999",
			"someone-else@example.com",
		]);
		await signInAs("99999999-9999-4999-8999-999999999999");
		const stranger = await checkout(
			platformRequest("/api/billing/checkout", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(stranger.status).toBe(404);
		expect(mocks.checkoutCreate).not.toHaveBeenCalled();
	});

	it("opens a subscription checkout with both prices for a trial site", async () => {
		const { site, accountId } = await setupSite(
			{ planStatus: "trial" },
			STRIPE_ENV,
		);
		await signInAs(accountId);
		mocks.checkoutCreate.mockResolvedValue({
			url: "https://checkout.stripe.test/s",
		});
		const response = await checkout(
			platformRequest("/api/billing/checkout", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(response.status).toBe(200);
		expect(await response.json()).toEqual({
			url: "https://checkout.stripe.test/s",
		});
		expect(mocks.constructed).toEqual(["sk_test_123"]);
		expect(mocks.checkoutCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				mode: "subscription",
				line_items: [
					{ price: "price_yearly", quantity: 1 },
					{ price: "price_overage" },
				],
				customer_email: "owner@example.com",
				client_reference_id: site.id,
				metadata: { siteId: site.id },
				success_url: `${ORIGIN}/konto/strony/${site.id}?billing=success`,
				cancel_url: `${ORIGIN}/konto/strony/${site.id}?billing=canceled`,
			}),
		);
	});

	it("reuses the Stripe customer and opens the portal for it", async () => {
		const { site, accountId } = await setupSite(
			{ planStatus: "canceled" },
			STRIPE_ENV,
		);
		await run("update sites set stripe_customer_id = 'cus_42' where id = ?", [
			site.id,
		]);
		await signInAs(accountId);
		mocks.checkoutCreate.mockResolvedValue({
			url: "https://checkout.stripe.test/s",
		});
		await checkout(
			platformRequest("/api/billing/checkout", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		const params = mocks.checkoutCreate.mock.calls[0][0];
		expect(params.customer).toBe("cus_42");
		expect(params.customer_email).toBeUndefined();

		mocks.portalCreate.mockResolvedValue({
			url: "https://billing.stripe.test/p",
		});
		const response = await portal(
			platformRequest("/api/billing/portal", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(await response.json()).toEqual({
			url: "https://billing.stripe.test/p",
		});
		expect(mocks.portalCreate).toHaveBeenCalledWith(
			expect.objectContaining({
				customer: "cus_42",
				return_url: `${ORIGIN}/konto/strony/${site.id}`,
			}),
		);
	});

	it("has no portal for a site that never paid", async () => {
		const { site, accountId } = await setupSite({}, STRIPE_ENV);
		await signInAs(accountId);
		const response = await portal(
			platformRequest("/api/billing/portal", {
				method: "POST",
				json: { siteId: site.id },
			}),
		);
		expect(response.status).toBe(409);
		expect(mocks.portalCreate).not.toHaveBeenCalled();
	});
});

describe("webhook", () => {
	it("rejects a bad signature and never records the event", async () => {
		await setupSite({}, STRIPE_ENV);
		trustPayload();
		const response = await webhook(
			webhookRequest(
				stripeEvent("evt_1", "checkout.session.completed", {}),
				"t=1,v1=forged",
			),
		);
		expect(response.status).toBe(400);
		expect(await all("select id from billing_events")).toEqual([]);
		expect(
			(
				await webhook(
					new Request(`${ORIGIN}/api/billing/webhook`, {
						method: "POST",
						body: "{}",
					}),
				)
			).status,
		).toBe(400);
	});

	it("activates the site on checkout and applies each event once", async () => {
		const { site } = await setupSite({ planStatus: "trial" }, STRIPE_ENV);
		trustPayload();
		mocks.retrieveSubscription.mockResolvedValue({
			id: "sub_1",
			status: "active",
			items: { data: [{ current_period_end: 1_900_000_000 }] },
		});
		const event = stripeEvent("evt_checkout", "checkout.session.completed", {
			client_reference_id: site.id,
			customer: "cus_1",
			subscription: "sub_1",
			metadata: { siteId: site.id },
		});

		const first = await webhook(webhookRequest(event));
		expect(first.status).toBe(200);
		expect(await first.json()).toEqual({ received: true });
		const paid = await findSiteById(site.id);
		expect(paid).toMatchObject({
			plan_status: "active",
			stripe_customer_id: "cus_1",
			stripe_subscription_id: "sub_1",
			current_period_end: new Date(1_900_000_000_000).toISOString(),
		});
		expect(mocks.retrieveSubscription).toHaveBeenCalledWith("sub_1");

		await run("update sites set plan_status = 'trial' where id = ?", [site.id]);
		const again = await webhook(webhookRequest(event));
		expect(await again.json()).toEqual({ received: true, duplicate: true });
		expect((await findSiteById(site.id))?.plan_status).toBe("trial");
		expect(mocks.retrieveSubscription).toHaveBeenCalledTimes(1);
		expect(await all("select id, type from billing_events")).toEqual([
			{ id: "evt_checkout", type: "checkout.session.completed" },
		]);
	});

	it("follows the subscription through past_due, deletion and failed invoices", async () => {
		const { site } = await setupSite({ planStatus: "active" }, STRIPE_ENV);
		await run(
			"update sites set stripe_customer_id = 'cus_1', stripe_subscription_id = 'sub_1' where id = ?",
			[site.id],
		);
		trustPayload();

		await webhook(
			webhookRequest(
				stripeEvent("evt_upd_1", "customer.subscription.updated", {
					id: "sub_1",
					customer: "cus_1",
					status: "past_due",
					items: { data: [{ current_period_end: 1_900_000_000 }] },
				}),
			),
		);
		expect(await findSiteById(site.id)).toMatchObject({
			plan_status: "past_due",
			current_period_end: new Date(1_900_000_000_000).toISOString(),
		});

		await webhook(
			webhookRequest(
				stripeEvent("evt_upd_2", "customer.subscription.updated", {
					id: "sub_1",
					customer: "cus_1",
					status: "active",
					items: { data: [{ current_period_end: 1_930_000_000 }] },
				}),
			),
		);
		expect(await findSiteById(site.id)).toMatchObject({
			plan_status: "active",
			current_period_end: new Date(1_930_000_000_000).toISOString(),
		});

		await webhook(
			webhookRequest(
				stripeEvent("evt_upd_3", "customer.subscription.updated", {
					id: "sub_1",
					customer: "cus_1",
					status: "paused",
					items: { data: [] },
				}),
			),
		);
		expect((await findSiteById(site.id))?.plan_status).toBe("active");

		await webhook(
			webhookRequest(
				stripeEvent("evt_inv", "invoice.payment_failed", {
					customer: "cus_1",
					parent: { subscription_details: { subscription: "sub_1" } },
				}),
			),
		);
		expect((await findSiteById(site.id))?.plan_status).toBe("past_due");

		await webhook(
			webhookRequest(
				stripeEvent("evt_del", "customer.subscription.deleted", {
					id: "sub_1",
					customer: "cus_1",
					status: "canceled",
					items: { data: [] },
				}),
			),
		);
		expect((await findSiteById(site.id))?.plan_status).toBe("canceled");

		const unknown = await webhook(
			webhookRequest(stripeEvent("evt_other", "charge.succeeded", {})),
		);
		expect(unknown.status).toBe(200);
	});

	it("forgets an event it failed to apply so Stripe can retry", async () => {
		const { site } = await setupSite({ planStatus: "trial" }, STRIPE_ENV);
		trustPayload();
		mocks.retrieveSubscription.mockRejectedValue(new Error("stripe down"));
		const response = await webhook(
			webhookRequest(
				stripeEvent("evt_fail", "checkout.session.completed", {
					client_reference_id: site.id,
					customer: "cus_1",
					subscription: "sub_1",
				}),
			),
		);
		expect(response.status).toBe(500);
		expect(await all("select id from billing_events")).toEqual([]);
		expect((await findSiteById(site.id))?.plan_status).toBe("trial");
	});
});

describe("reportStorageOverage", () => {
	it("sends the current block count only when it changes, and never throws", async () => {
		const { site } = await setupSite({ planStatus: "active" }, STRIPE_ENV);
		await insertPhoto(site.id, {
			archiveStatus: "uploaded",
			originalSize: 4096,
		});
		await syncStorageUsage(site.id);
		expect(mocks.meterEventCreate).not.toHaveBeenCalled();

		await run(
			"update sites set stripe_customer_id = 'cus_1', included_archive_bytes = 0 where id = ?",
			[site.id],
		);
		mocks.meterEventCreate.mockResolvedValue({});
		await syncStorageUsage(site.id);
		expect(mocks.meterEventCreate).toHaveBeenCalledWith({
			event_name: "wianki_storage_overage_blocks",
			payload: { stripe_customer_id: "cus_1", value: "1" },
		});
		expect((await findSiteById(site.id))?.overage_blocks_reported).toBe(1);

		await reportStorageOverage(site.id);
		expect(mocks.meterEventCreate).toHaveBeenCalledTimes(1);

		await run("update sites set included_archive_bytes = ? where id = ?", [
			INCLUDED_ARCHIVE_BYTES,
			site.id,
		]);
		mocks.meterEventCreate.mockRejectedValue(new Error("meter down"));
		const quiet = vi.spyOn(console, "error").mockImplementation(() => {});
		await expect(reportStorageOverage(site.id)).resolves.toBeUndefined();
		expect(mocks.meterEventCreate).toHaveBeenLastCalledWith(
			expect.objectContaining({
				payload: { stripe_customer_id: "cus_1", value: "0" },
			}),
		);
		expect((await findSiteById(site.id))?.overage_blocks_reported).toBe(1);
		quiet.mockRestore();
	});
});
