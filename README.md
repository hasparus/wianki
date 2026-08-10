# Wedding photo gallery

Private, mobile-first wedding gallery. Guests upload from their phones. The web
derivative goes to private Supabase Storage. The original streams through a
Cloudflare Worker into an archive you pick: an R2 bucket, or a Drive folder you
own. Vision SafeSearch checks the derivative before it publishes.

Trust your guests? `MODERATION_ENABLED=false`. Photos auto-approve at
finalization, appear at once, no Vision credentials needed.

UI and ops docs are Polish-first. Technical docs are English, so agents share
exact contracts.

## Local prerequisites

- Node 24, npm
- Docker Desktop, for local Supabase
- Supabase CLI (`npx supabase`)
- Cloudflare account + Wrangler
- Google Cloud project with Vision API, unless `MODERATION_ENABLED=false`
- Drive backend only: Google OAuth desktop client with `drive.file`

`.env.example` -> `.env.local`, replace every placeholder. Never commit
`.env.local`, `.dev.vars`, `private/`, `oauth-output/`.

```powershell
npm install
npx supabase start
npx supabase db reset
npm run dev
```

Checks:

```powershell
npm run check
npm run test:e2e
```

## Integration order

1. EU Supabase project, link with `npx supabase link`.
2. `npx supabase db push`. Confirm the `gallery` bucket is private.
3. Project URL, publishable key, secret key -> Vercel.
4. Google Cloud project with billing, Vision API on.
5. Vision-only service account. Project ID, email, private key -> Vercel. Skip
   4 and 5 with `MODERATION_ENABLED=false`.
6. Pick the archive. Set `ARCHIVE_BACKEND` in both
   `workers/archive/wrangler.jsonc` and Vercel.

   **`r2`** (default). Bucket in the same Cloudflare account,
   `r2_buckets[0].bucket_name` points at it. No Google, no consent screen, no
   refresh token to renew. Deletion is immediate and final.

   **`drive`**. Originals sit in a folder you own and can open from any Drive
   client, and deletion only trashes them — Drive keeps it 30 days. Costs a
   consent screen and a refresh token that dies after 7 days unless the consent
   app is published to Production. Desktop OAuth client with `drive.file`, set
   `GOOGLE_DRIVE_OAUTH_CLIENT_ID` and `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, run
   `npm run drive:bootstrap`. Drop the `r2_buckets` block from
   `wrangler.jsonc`, copy the four values out of the ignored
   `oauth-output/drive-oauth.json`:

   ```powershell
   cd workers/archive
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
   npx wrangler secret put GOOGLE_OAUTH_REFRESH_TOKEN
   npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
   ```

7. Shared archive secret on the Worker:

   ```powershell
   cd workers/archive
   npx wrangler secret put ARCHIVE_TOKEN_SECRET
   ```

8. `ALLOWED_ORIGIN` in `wrangler.jsonc`, deploy the Worker, then both Worker
   URLs (server and public) -> Vercel.
9. Attach `wedding.pawel.space` to Vercel with the DNS record it asks for.
10. Production origin, deletion-contact email, and four independent random
    secrets: guest entry, guest session, admin entry, admin session.
11. `npm run qr:generate`. Print the guest QR. Guard the admin QR like a shared
    admin password.

Optional: `GUEST_JOIN_CODE` adds a short join QR to the slideshow corner.
`SLIDESHOW_LIVE_URL` + `SLIDESHOW_LIVE_SECRET` turn on live reactions. See
[docs/slideshow.md](docs/slideshow.md).

Read [integration setup](docs/integrations.md) and the
[event runbook](docs/operations.md) before deploying.

## Architecture map

- `proxy.ts` — token exchange, clean redirects, optimistic route checks
- `app/api/uploads` — capability issuance, verified finalization
- `app/api/gallery` — approved-photo pagination and stats
- `app/api/admin` — moderation, reconciliation, deletion
- `workers/archive` — streaming upload and archive lifecycle, one backend per
  deployment (`src/r2.ts`, `src/drive.ts`)
- `app/pokaz` + `app/admin/pokaz` — live slideshow and its editor
- `workers/slideshow-live` — PartyServer room for ephemeral reactions and
  comments (`docs/slideshow.md`)
- `lib/slideshow-protocol.ts` — the live wire contract, shared by app and worker
- `supabase/migrations` — tables, enums, indexes, RLS, private bucket

## Recovery

- Lost guest QR -> rotate `GUEST_ENTRY_TOKEN`, regenerate, reprint.
- Leaked join code -> rotate `GUEST_JOIN_CODE`. Printed table QRs survive.
- Lost admin QR -> rotate `ADMIN_ENTRY_TOKEN` + `ADMIN_SESSION_SECRET`. Every
  existing admin cookie dies.
- Bad Drive refresh token -> rerun `npm run drive:bootstrap`, replace the
  Worker secret.
- Partial upload -> "Znajdź w archiwum" from `/admin`.
- Partial deletion -> the admin queue keeps the error and lets you retry.
