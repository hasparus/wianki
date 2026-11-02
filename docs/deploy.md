# Deploying with Alchemy

Everything the platform runs on is declared in `alchemy.run.ts` and lives in
one Cloudflare account: a Next.js Worker built by OpenNext, two Workers at the
storage boundary, a D1 database and two R2 buckets. Alchemy creates them,
applies D1 migrations, attaches domains and hands every secret to the right
Worker. There is no dashboard clicking in the happy path.

## From zero

1. **Cloudflare account.** Workers Paid ($5/month) is required: Durable
   Objects with SQLite back the live slideshow, and the free plan's Worker
   limits are too tight for a Next.js app. Note the account id (dashboard
   sidebar).
2. **API token.** *My Profile → API Tokens → Create Token → Custom*. Scopes:
   - Account: Workers Scripts (Edit), Workers R2 Storage (Edit), D1 (Edit),
     Workers Tail (Read), Account Settings (Read), Email Routing Addresses
     (Edit) if you will send magic links
   - Zone (only if attaching a domain): Workers Routes (Edit), DNS (Edit),
     Zone (Read)
   - User: User Details (Read)

   Put the id and token in `.env` as `CLOUDFLARE_ACCOUNT_ID` and
   `CLOUDFLARE_API_TOKEN`. The file is git-ignored and the alchemy CLI loads it.
3. **State password.** `ALCHEMY_PASSWORD` encrypts secrets inside Alchemy's
   state. Pick a long random string and keep it: without it the state cannot
   be read and the stage has to be adopted or rebuilt.
4. **Application secrets.** `SESSION_SECRET`, `ARCHIVE_TOKEN_SECRET`,
   `SLIDESHOW_LIVE_SECRET`: 32+ random bytes each (`openssl rand -base64 32`).
   They are the only values that must exist on every deploy; everything else
   is optional and described below.
5. **First deploy.**

   ```sh
   npm ci
   npx alchemy deploy --stage prod
   ```

   The run prints the workers.dev URLs of the app and both Workers. With no
   zone configured that is the whole deployment: the app answers on
   `wianki-app-prod.<subdomain>.workers.dev`, and `PLATFORM_HOST` must be set
   to exactly that host so cookies and the owner console agree.

## Platform host and wildcard subdomains

Each wedding is served on `<slug>.<PLATFORM_HOST>` or on a custom domain
stored in D1. That needs:

- the platform host to be a **zone in the same Cloudflare account**
  (`CLOUDFLARE_ZONE_ID`);
- a proxied **wildcard DNS record** `*.<host>` (A `192.0.2.1` or a CNAME to
  the apex, orange cloud on), so requests for any subdomain reach Cloudflare;
- a **Worker route** `*.<host>/*`. Worker custom domains do not accept
  wildcards, so `alchemy.run.ts` attaches the apex as a custom domain and the
  subdomains through a route. Both are declared only when
  `CLOUDFLARE_ZONE_ID` is set.

Custom domains of individual weddings (`custom_domain` in D1) are not managed
by Alchemy: the owner points a CNAME at the platform host and the site is
added to the Worker as a custom hostname (Cloudflare for SaaS) or an extra
custom domain by hand. The proxy resolves any unknown host by that column.

Universal SSL covers the apex and one level of wildcard on every plan, so
`rosia.wianki.app` gets a certificate automatically.

## Storage

- **R2, jurisdiction `eu`.** Both buckets are created with the EU
  jurisdiction so data stays in EU data centres; this cannot be changed after
  creation. `wianki-gallery-<stage>` holds the EXIF-free derivatives (Standard
  class), `wianki-originals-<stage>` the originals (Infrequent Access as the
  bucket default, plus a rule that aborts multipart uploads older than a day).
- **D1, jurisdiction `eu`, primary in `weur`.** Migrations in
  `db/migrations` are applied by Alchemy on every deploy (tracked in
  `d1_migrations`), and by `alchemy dev` locally. Add a new file with the next
  number; never edit an applied one.

## Secrets

Secrets never enter Git or `wrangler.jsonc`. `alchemy.run.ts` reads them from
the environment and binds them to Workers as encrypted secrets; Alchemy's
state keeps an encrypted copy under `ALCHEMY_PASSWORD` so it can tell when
they change. To rotate one: change the environment value, deploy again.

| Variable | Goes to | Required |
| --- | --- | --- |
| `SESSION_SECRET` | app | yes |
| `ARCHIVE_TOKEN_SECRET` | app, archive Worker | yes |
| `SLIDESHOW_LIVE_SECRET` | app, slideshow Worker (`LIVE_TOKEN_SECRET`) | yes |
| `GOOGLE_VISION_CLIENT_EMAIL` / `GOOGLE_VISION_PRIVATE_KEY` | app | sites with moderation |
| `STRIPE_SECRET_KEY` | app, and Alchemy's Stripe provider | billing |
| `EMAIL_FROM` | app (`SEND_EMAIL` binding) | magic-link mail |

## Stripe (optional)

With `STRIPE_SECRET_KEY` set, `alchemy.run.ts` creates in that Stripe account:

- product *Wianki — galeria ślubna*;
- a licensed yearly price of $49 (`lookup_key = wianki_yearly`);
- a billing meter `wianki_storage_overage_blocks` (aggregation *last*,
  customer mapped by `stripe_customer_id`, value in `value`) and a metered
  yearly price of $5 per extra 10 GB block (`wianki_storage_overage`);
- a webhook endpoint at `https://<PLATFORM_HOST>/api/billing/webhook` for
  `checkout.session.completed`, `customer.subscription.updated`,
  `customer.subscription.deleted` and `invoice.payment_failed`.

The resulting price ids and the webhook signing secret are passed into the
app as `STRIPE_PRICE_YEARLY`, `STRIPE_PRICE_OVERAGE` and
`STRIPE_WEBHOOK_SECRET`. Use a test-mode key on non-prod stages; the Stripe
objects are per stage like everything else.

## Email Sending (optional)

Owner magic links go out through Cloudflare Email Sending when `EMAIL_FROM` is
set. The sender's domain must be added to Email Routing in the account and
verified first. Without `EMAIL_FROM` the app logs the link instead of mailing
it, which is what you want in development.

## `alchemy dev` versus `next dev`

- `npm run infra:dev` (`alchemy dev`) runs the whole stage locally: the two
  Workers in miniflare, the Next.js dev server with D1 and R2 emulated, and
  writes `wrangler.jsonc` for the dev stage. First time, also run
  `npm run db:reset:local` so the emulated database has the demo site.
- `npm run dev` (`next dev`) is the plain Next.js server. It still gets a
  local D1 and R2 through `initOpenNextCloudflareForDev()` in
  `next.config.ts`, which reads `wrangler.jsonc` when Alchemy has written one
  and the checked-in `wrangler.local.jsonc` otherwise. Run
  `npm run db:reset:local` once (migrations, then `db/seed-dev.sql`). The
  other variables come from `.env.local`; see `.env.example`.
- Both persist under `.wrangler/state/v3` and use the database id
  `wianki-dev`, so they share the SQLite file. If `alchemy dev` was first run
  for a different stage, point the db scripts at its config:
  `npx wrangler d1 migrations apply DB --local --config wrangler.jsonc`.
- `npm run preview` builds with OpenNext (`npm run build:cf`, which reads
  `wrangler.local.jsonc`) and serves the real Worker bundle in workerd, the
  closest thing to production on a laptop. `wrangler dev` does not see the
  shell environment: put the app's variables in a git-ignored `.dev.vars`
  (same keys as `.env.example`, no Cloudflare or Alchemy ones) next to
  `wrangler.local.jsonc`.

The demo site (`db/seed-dev.sql`) has `custom_domain = localhost`, so
`http://localhost:3000` is the wedding and `http://platform.localhost:3000`
(or whatever `PLATFORM_HOST` says) is the owner console. Its guest passphrase
is `e2e invitation passphrase`, the admin one `e2e admin passphrase long`.

## Stages and state

A stage is a complete copy of the platform: `--stage prod`, `--stage dev`,
`--stage pr-12`. Resource names carry the stage (`wianki-prod`,
`wianki-archive-pr-12`). The stage comes from `--stage`, then
`ALCHEMY_STAGE`, then `dev`.

Alchemy's state maps the resources in `alchemy.run.ts` to real ids. Locally it
is the `.alchemy/` directory (git-ignored; back it up or re-adopt with
`--adopt` if lost). In CI (`CI=true`) the file uses `CloudflareStateStore`,
which keeps state in a small Durable Object in the same account behind
`ALCHEMY_STATE_TOKEN`, so every GitHub Actions run sees the same state.

GitHub Actions deploys `main` to `prod` when the repository variable
`ALCHEMY_DEPLOY` is `true`. Secrets it needs: `CLOUDFLARE_ACCOUNT_ID`,
`CLOUDFLARE_API_TOKEN`, `CLOUDFLARE_ZONE_ID`, `ALCHEMY_PASSWORD`,
`ALCHEMY_STATE_TOKEN`, `SESSION_SECRET`, `ARCHIVE_TOKEN_SECRET`,
`SLIDESHOW_LIVE_SECRET`, optionally `STRIPE_SECRET_KEY`,
`GOOGLE_VISION_CLIENT_EMAIL`, `GOOGLE_VISION_PRIVATE_KEY`. Variables:
`PLATFORM_HOST`, optionally `EMAIL_FROM`, `CONSENT_VERSION`.

## Destroy

```sh
npx alchemy destroy --stage pr-12
```

removes every resource of that stage, including the buckets and the database
with their contents. Keep `prod` out of habit: there is no confirmation
prompt beyond the stage name.

## Costs

Prices as of 2026, USD, Cloudflare list prices. Egress from R2 is free on
every class, which is what makes a photo archive affordable at all.

| Item | Price |
| --- | --- |
| R2 Standard | $0.015 per GB-month |
| R2 Infrequent Access | $0.01 per GB-month, 30-day minimum, $0.01 per GB retrieved |
| R2 egress | $0 |
| D1 | free tier: 5 GB, 5M reads and 100k writes a day; paid: $0.75/M reads, $1/M writes, $0.75/GB-month |
| Workers | included in Workers Paid ($5/month): 10M requests, then $0.30/M |
| Durable Objects (SQLite) | included in Workers Paid for the slideshow's usage |

A wedding keeps roughly 1–2 GB of derivatives (hot, Standard) and the
originals in Infrequent Access.

**10 GB wedding.** Originals: 10 GB × $0.01 × 12 = $1.20 a year. Derivatives:
1 GB × $0.015 × 12 = $0.18. Retrieval only when the couple downloads the
archive once: 10 GB × $0.01 = $0.10. About $1.50 a year of storage against
the $49 plan; the fixed $5/month Workers plan is shared by every wedding on
the deployment.

**50 GB wedding.** Originals: 50 × $0.01 × 12 = $6.00, derivatives ≈ $0.50,
a full download $0.50, about $7 a year. The site is 40 GB over the included
10 GB, which is 4 overage blocks × $5 = $20 a year on top of the $49, so the
overage price is a margin, not a pass-through.

D1 stays in the free tier until well past a hundred weddings: a gallery page
is one query, uploads are a handful of writes per photo.
