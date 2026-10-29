/**
 * Wianki infrastructure, declared with Alchemy (https://alchemy.run).
 *
 *   npx alchemy dev                 local stage, everything emulated
 *   npx alchemy deploy --stage prod production
 *   npx alchemy destroy --stage pr-12
 *
 * One stage = one complete platform: a D1 database, two R2 buckets, the
 * archive Worker, the slideshow-live Worker and the Next.js app Worker. Every
 * credential is read from the environment of the machine running this file
 * (a `.env` next to it is loaded automatically by the alchemy CLI) and handed
 * to the Workers as encrypted secrets. Nothing here is written to Git except
 * this file: `wrangler.jsonc`, `.alchemy/` and `.open-next/` are ignored.
 *
 * See docs/deploy.md for the account, token scopes and DNS requirements.
 */
import alchemy from "alchemy";
import {
	type Binding,
	D1Database,
	DurableObjectNamespace,
	EmailSender,
	Nextjs,
	R2Bucket,
	Worker,
} from "alchemy/cloudflare";
import { CloudflareStateStore } from "alchemy/state";
import { Meter, Price, Product, WebhookEndpoint } from "alchemy/stripe";

/** `--stage x` on the command line wins, then ALCHEMY_STAGE, then "dev". */
function stageFromArgv() {
	const index = process.argv.indexOf("--stage");
	return index === -1 ? undefined : process.argv[index + 1];
}

const stage = stageFromArgv() ?? process.env.ALCHEMY_STAGE ?? "dev";
const isLocal =
	process.argv.includes("--dev") || process.argv.includes("--local");

function required(name: string): string {
	const value = process.env[name];
	if (!value) {
		throw new Error(
			`Missing ${name}. Copy .env.example to .env and fill it in, or export it; see docs/deploy.md.`,
		);
	}
	return value;
}

/** A secret binding only when the variable is set, so optional integrations stay optional. */
function optionalSecret(name: string): Record<string, Binding> {
	const value = process.env[name];
	return value ? { [name]: alchemy.secret(value, name) } : {};
}

/**
 * Host (no scheme) the owner console answers on. Each wedding is a subdomain
 * of it (`rosia.wianki.app`) or a custom domain stored in D1. In development
 * the Next.js dev server is the platform and `demo.localhost:3000` is a site.
 */
// `||`, not `??`: a CI runner passes unset repository variables as "".
const platformHost =
	process.env.PLATFORM_HOST ||
	(stage === "prod" ? required("PLATFORM_HOST") : "localhost:3000");
const platformOrigin = /^(localhost|127\.0\.0\.1)(:\d+)?$/.test(platformHost)
	? `http://${platformHost}`
	: `https://${platformHost}`;

/**
 * Custom hostnames need a zone in the same Cloudflare account. Without
 * CLOUDFLARE_ZONE_ID the app is reachable on its workers.dev URL only, which
 * is enough for previews and for `alchemy dev`.
 */
const zoneId = process.env.CLOUDFLARE_ZONE_ID;

/** Pin the runtime; bump deliberately after reading the Workers changelog. */
const compatibilityDate = "2026-10-01";

const app = await alchemy("wianki", {
	stage,
	// A CI runner has no disk that survives the job, so state (the mapping
	// from this file to real resource ids, plus encrypted secrets) lives in the
	// Cloudflare account behind ALCHEMY_STATE_TOKEN. Locally the default
	// `.alchemy/` directory is used.
	stateStore: process.env.CI
		? (scope) => new CloudflareStateStore(scope)
		: undefined,
});

// ---------------------------------------------------------------------------
// Storage
// ---------------------------------------------------------------------------

/** EXIF-free web derivatives, served through the app. Hot path: Standard. */
const gallery = await R2Bucket("gallery", {
	name: `wianki-gallery-${stage}`,
	jurisdiction: "eu",
	storageClass: "Standard",
});

/**
 * Originals, written once by the archive Worker and read back only on
 * demand. Infrequent Access is a third cheaper per GB and egress is free; the
 * 30-day minimum and the retrieval fee do not matter for a photo archive.
 */
const originals = await R2Bucket("originals", {
	name: `wianki-originals-${stage}`,
	jurisdiction: "eu",
	storageClass: "InfrequentAccess",
	lifecycle: [
		{
			id: "abort-incomplete-multipart-uploads",
			enabled: true,
			abortMultipartUploadsTransition: {
				condition: { type: "Age", maxAge: 24 * 60 * 60 },
			},
		},
	],
});

/** One database for every wedding; every row carries site_id. */
const db = await D1Database("db", {
	name: `wianki-${stage}`,
	jurisdiction: "eu",
	primaryLocationHint: "weur",
	// Applied on deploy (and locally by `alchemy dev`). The same directory
	// feeds `wrangler d1 migrations apply` for the plain `next dev` flow.
	migrationsDir: "db/migrations",
});

// ---------------------------------------------------------------------------
// Workers at the storage boundary
// ---------------------------------------------------------------------------

/**
 * Streams originals from the guest's browser into the archive and signs a
 * receipt the app verifies at finalization. CORS is derived from
 * PLATFORM_HOST and the token's origin claim, so one Worker serves every site.
 */
const archive = await Worker("archive", {
	name: `wianki-archive-${stage}`,
	entrypoint: "workers/archive/src/index.ts",
	compatibilityDate,
	compatibilityFlags: ["nodejs_compat"],
	url: true,
	observability: { enabled: true },
	bindings: {
		ARCHIVE_BACKEND: "r2",
		PLATFORM_HOST: platformHost,
		ARCHIVE_BUCKET: originals,
		ARCHIVE_TOKEN_SECRET: alchemy.secret(
			required("ARCHIVE_TOKEN_SECRET"),
			"ARCHIVE_TOKEN_SECRET",
		),
	},
});

/** PartyServer room per site for ephemeral slideshow reactions. */
const slideshowParty = DurableObjectNamespace("slideshow-party", {
	className: "SlideshowParty",
	sqlite: true,
});

const slideshow = await Worker("slideshow-live", {
	name: `wianki-slideshow-live-${stage}`,
	entrypoint: "workers/slideshow-live/src/index.ts",
	compatibilityDate,
	compatibilityFlags: ["nodejs_compat"],
	url: true,
	observability: { enabled: true },
	bindings: {
		SlideshowParty: slideshowParty,
		PLATFORM_HOST: platformHost,
		LIVE_TOKEN_SECRET: alchemy.secret(
			required("SLIDESHOW_LIVE_SECRET"),
			"SLIDESHOW_LIVE_SECRET",
		),
	},
});

if (!archive.url || !slideshow.url) {
	throw new Error(
		"Workers need `url: true` so the app can be told where they live.",
	);
}

// ---------------------------------------------------------------------------
// Stripe (optional). Declared only when a key is present; the app treats a
// missing STRIPE_SECRET_KEY as "billing off" (self-hosted, local dev).
// ---------------------------------------------------------------------------

async function stripeBindings(): Promise<Record<string, Binding>> {
	const key = process.env.STRIPE_SECRET_KEY;
	if (!key) return {};
	const apiKey = alchemy.secret(key, "STRIPE_SECRET_KEY");

	const product = await Product("product", {
		name: "Wianki — galeria ślubna",
		description: "Prywatna galeria ślubna na rok: 10 GB oryginałów w cenie.",
		apiKey,
	});

	/** $49 a year, licensed: one subscription per wedding site. */
	const yearly = await Price("price-yearly", {
		product: product.id,
		currency: "usd",
		unitAmount: 4900,
		recurring: { interval: "year" },
		lookupKey: "wianki_yearly",
		transferLookupKey: true,
		apiKey,
	});

	/**
	 * How many extra 10 GB blocks of originals a site holds beyond the included
	 * 10 GB. The app reports the current block count after every change, and
	 * "last during period" bills the state at period end, not a running sum.
	 */
	const storageMeter = await Meter("storage-overage-meter", {
		displayName: "Wianki storage overage (10 GB blocks)",
		eventName: "wianki_storage_overage_blocks",
		defaultAggregation: { formula: "last" },
		customerMapping: { eventPayloadKey: "stripe_customer_id", type: "by_id" },
		valueSettings: { eventPayloadKey: "value" },
		apiKey,
	});

	/** $5 per extra block per year, metered through the meter above. */
	const overage = await Price("price-storage-overage", {
		product: product.id,
		currency: "usd",
		unitAmount: 500,
		recurring: { interval: "year", usageType: "metered", meter: storageMeter },
		lookupKey: "wianki_storage_overage",
		transferLookupKey: true,
		apiKey,
	});

	const webhook = await WebhookEndpoint("webhook", {
		url: `${platformOrigin}/api/billing/webhook`,
		description: `Wianki ${stage}`,
		enabledEvents: [
			"checkout.session.completed",
			"customer.subscription.updated",
			"customer.subscription.deleted",
			"invoice.payment_failed",
		],
		apiKey,
	});

	return {
		STRIPE_SECRET_KEY: apiKey,
		STRIPE_WEBHOOK_SECRET: alchemy.secret(
			webhook.secret,
			"STRIPE_WEBHOOK_SECRET",
		),
		STRIPE_PRICE_YEARLY: yearly.id,
		STRIPE_PRICE_OVERAGE: overage.id,
	};
}

// ---------------------------------------------------------------------------
// The Next.js app: owner console on the platform host, one site per subdomain
// or custom domain. Built by OpenNext into .open-next/worker.js.
// ---------------------------------------------------------------------------

/**
 * Magic-link mail goes out through Cloudflare Email Sending when EMAIL_FROM is
 * set; its domain must be verified in the account first. Without it the app
 * logs the links, which is fine for development.
 */
const emailFrom = process.env.EMAIL_FROM;
const emailBindings: Record<string, Binding> = emailFrom
	? {
			SEND_EMAIL: EmailSender({ allowedSenderAddresses: [emailFrom] }),
			EMAIL_FROM: emailFrom,
		}
	: {};

const site = await Nextjs("app", {
	name: `wianki-app-${stage}`,
	compatibilityDate,
	// Nextjs() already adds nodejs_compat and global_fetch_strictly_public;
	// repeating nodejs_compat here would be sent to the API twice.
	url: true,
	observability: { enabled: true },
	bindings: {
		DB: db,
		GALLERY: gallery,
		...emailBindings,

		PLATFORM_HOST: platformHost,
		CONSENT_VERSION: process.env.CONSENT_VERSION || "2026-07-23",
		SIGNUP_ENABLED: process.env.SIGNUP_ENABLED || "true",

		// Where the browser streams originals and where the app verifies receipts.
		ARCHIVE_WORKER_URL: archive.url,
		NEXT_PUBLIC_ARCHIVE_WORKER_URL: archive.url,
		ARCHIVE_TOKEN_SECRET: alchemy.secret(
			required("ARCHIVE_TOKEN_SECRET"),
			"ARCHIVE_TOKEN_SECRET",
		),

		SLIDESHOW_LIVE_URL: slideshow.url,
		SLIDESHOW_LIVE_SECRET: alchemy.secret(
			required("SLIDESHOW_LIVE_SECRET"),
			"SLIDESHOW_LIVE_SECRET",
		),

		// Root of every cookie and token key; rotating it logs everyone out.
		SESSION_SECRET: alchemy.secret(
			required("SESSION_SECRET"),
			"SESSION_SECRET",
		),

		// Vision SafeSearch, only for sites that turn moderation on.
		...optionalSecret("GOOGLE_VISION_CLIENT_EMAIL"),
		...optionalSecret("GOOGLE_VISION_PRIVATE_KEY"),

		...(await stripeBindings()),
	},
	// Wildcard subdomains cannot be Worker custom domains, so the platform
	// host is attached as a custom domain and the sites through a route. Both
	// need the zone in this account and, for the route, a proxied wildcard DNS
	// record (`*` -> 192.0.2.1 or a CNAME) so requests reach the Worker at all.
	...(zoneId && !isLocal
		? {
				domains: [{ domainName: platformHost, zoneId, adopt: true }],
				routes: [{ pattern: `*.${platformHost}/*`, zoneId, adopt: true }],
			}
		: {}),
});

console.log(`stage       ${stage}`);
console.log(`app         ${site.url ?? "(no url yet)"}`);
console.log(`platform    ${platformOrigin}`);
console.log(`archive     ${archive.url}`);
console.log(`slideshow   ${slideshow.url}`);
console.log(`d1          ${db.name}`);
console.log(`r2          ${gallery.name}, ${originals.name}`);

await app.finalize();

export { archive, db, gallery, originals, site, slideshow };
