# Wianki — wedding photo galleries

Private, mobile-first wedding galleries, one platform serving many weddings.
Guests upload from their phones. The web derivative goes to a private R2
bucket. The original streams through a Cloudflare Worker into a second,
cheaper R2 bucket. Vision SafeSearch checks the derivative before it
publishes, for the sites that turn moderation on.

Trust your guests? Turn moderation off for the site. Photos auto-approve at
finalization, appear at once, no Vision credentials needed.

Everything runs on Cloudflare — Workers (the Next.js app through OpenNext),
D1, R2, Durable Objects — and is declared in `alchemy.run.ts`. The owner
console on the platform host creates sites; each wedding lives on
`<slug>.<platform host>` or on its own domain.

UI and ops docs are Polish-first. Technical docs are English, so agents share
exact contracts.

## Local prerequisites

- Node 24, npm
- Cloudflare account (Workers Paid) for a deployed stage; nothing for local
  work, D1 and R2 are emulated by wrangler
- Google Cloud project with Vision API, only for sites with moderation on

`.env.example` -> `.env.local` for `next dev`, or `.env` for alchemy; replace
every placeholder. Never commit either, nor `private/`, `oauth-output/`,
`wrangler.jsonc`, `.alchemy/`.

```powershell
npm install
npm run db:reset:local   # local D1: migrations + demo site (db/seed-dev.sql)
npm run dev              # http://localhost:3000 is the demo wedding
```

`npm run infra:dev` runs the Workers alongside the app in miniflare. The demo
site answers on `localhost`, the owner console on whatever `PLATFORM_HOST`
says (`platform.localhost:3000` in the tests). Passphrases of the demo site:
`e2e invitation passphrase` (guest), `e2e admin passphrase long` (admin).

Checks:

```powershell
npm run check
npm run test:e2e
```

## Integration order

1. Cloudflare account, API token, `CLOUDFLARE_ACCOUNT_ID` +
   `CLOUDFLARE_API_TOKEN` + `ALCHEMY_PASSWORD` in `.env`.
2. Three random secrets: `SESSION_SECRET`, `ARCHIVE_TOKEN_SECRET`,
   `SLIDESHOW_LIVE_SECRET`.
3. `npx alchemy deploy --stage prod`. D1, both R2 buckets (EU jurisdiction),
   the archive and slideshow Workers and the app come up; migrations are
   applied; the run prints the URLs.
4. Zone for the platform host in the same account, wildcard DNS record,
   `CLOUDFLARE_ZONE_ID` + `PLATFORM_HOST`, deploy again: the apex becomes the
   owner console, `*.<host>` the weddings.
5. Optional: `STRIPE_SECRET_KEY` (billing), `EMAIL_FROM` (magic-link mail
   through Cloudflare Email Sending), Vision service account (moderation).
6. Open the owner console, sign in with a magic link, create a site. Print the
   guest QR the console gives you. Guard the admin QR like a shared admin
   password.

The archive Worker keeps the `drive` backend in `src/drive.ts` for anyone who
wants originals in a Google Drive folder, but the platform deploys `r2` and
Alchemy does not configure Drive.

Read [docs/deploy.md](docs/deploy.md) for the full procedure and costs,
[integration setup](docs/integrations.md) and the
[event runbook](docs/operations.md) before deploying.

## Architecture map

- `alchemy.run.ts` — every Cloudflare, and optionally Stripe, resource
- `proxy.ts` — Host -> site resolution, token exchange, optimistic route checks
- `app/konto` + `app/api/konto` — owner console: sites, QR codes, billing
- `app/api/uploads` — capability issuance, verified finalization
- `app/api/gallery` — approved-photo pagination and stats
- `app/api/admin` — moderation, reconciliation, deletion
- `lib/cloudflare.ts`, `lib/db.ts`, `lib/storage.ts` — the only code that
  touches bindings (`DB`, `GALLERY`, `SEND_EMAIL`)
- `workers/archive` — streaming upload and archive lifecycle, one backend per
  deployment (`src/r2.ts`, `src/drive.ts`)
- `app/pokaz` + `app/admin/pokaz` — live slideshow and its editor
- `workers/slideshow-live` — PartyServer room for ephemeral reactions and
  comments (`docs/slideshow.md`)
- `lib/slideshow-protocol.ts` — the live wire contract, shared by app and worker
- `db/migrations` — D1 schema: tables, check constraints, indexes

## Recovery

- Lost guest QR -> rotate the site's guest entry token in the owner console,
  reprint.
- Leaked join code -> rotate the site's join code. Printed table QRs survive.
- Lost admin QR -> rotate the admin entry token and bump the site's session
  key version. Every existing admin and guest cookie of that site dies; no
  other site notices.
- Leaked `SESSION_SECRET` -> new value, `alchemy deploy`. Everyone on every
  site signs in again.
- Partial upload -> "Znajdź w archiwum" from `/admin`.
- Partial deletion -> the admin queue keeps the error and lets you retry.
- Lost Alchemy state -> `npx alchemy deploy --adopt` picks the existing
  resources up by name.
