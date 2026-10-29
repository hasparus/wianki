# Integration setup

## Cloudflare

One account, Workers Paid. `alchemy.run.ts` owns every resource: the app
Worker (OpenNext), `workers/archive`, `workers/slideshow-live`, the D1
database and the two R2 buckets, all created with the `eu` jurisdiction.
Credentials go into `.env` (`CLOUDFLARE_ACCOUNT_ID`, `CLOUDFLARE_API_TOKEN`,
`ALCHEMY_PASSWORD`) and never into `wrangler.jsonc`, which Alchemy generates
and Git ignores. `wrangler.local.jsonc` is the one checked-in wrangler file:
local-only bindings for `next dev`, no secrets.

Secrets reach the Workers as encrypted bindings from the environment of the
deploying machine: `SESSION_SECRET`, `ARCHIVE_TOKEN_SECRET` (app and archive
Worker), `SLIDESHOW_LIVE_SECRET` (app, and the slideshow Worker as
`LIVE_TOKEN_SECRET`). Rotate by changing the value and deploying again.

`PLATFORM_HOST` is a plain var on all three Workers. The archive and
slideshow Workers derive their CORS allow-list from it and from the origin
claim inside each token, so one Worker serves every site. The platform host
must be a zone in the account, with a proxied wildcard record and the Worker
route `*.<host>/*`; see [deploy.md](deploy.md).

`ARCHIVE_BACKEND` is fixed to `r2` by `alchemy.run.ts`. Plain var, not a
secret, so the deployed choice shows up in config review. The `drive` backend
stays in the Worker's source for self-hosters who want a browsable folder;
Alchemy does not configure it.

## Google Cloud

Only for sites that turn moderation on. Billing on, Vision API on. Service
account for Vision only, minimum invocation permission. Its email and private
key go in as `GOOGLE_VISION_CLIENT_EMAIL` and `GOOGLE_VISION_PRIVATE_KEY`;
set both or neither.

## Stripe

Optional. With `STRIPE_SECRET_KEY` in the environment, `alchemy.run.ts`
creates the product, the $49 yearly price, the storage-overage meter and
price, and the webhook endpoint at `/api/billing/webhook`, and passes the
price ids and webhook secret into the app. Test-mode key on non-prod stages.
Without the key, every site is treated as self-hosted: no checkout, no
usage reports, uploads are never blocked for billing reasons.

## Email

Owner sign-in is a magic link. With `EMAIL_FROM` set, the app sends it
through Cloudflare Email Sending (`SEND_EMAIL` binding); the sender's domain
must be verified under Email Routing in the account. Unset, the link is logged
by the Worker, which is only acceptable in development.

## DNS

The apex of `PLATFORM_HOST` is attached to the app Worker as a custom domain,
the subdomains through the wildcard route. A wedding with its own domain
points a CNAME at the platform host; the proxy looks the host up in the
`custom_domain` column. Preview stages (`--stage pr-12`) stay on workers.dev
URLs and never share a database or a bucket with production.
