# Wedding Photo Gallery

Private, mobile-first wedding gallery for guests. The application keeps a small
web derivative in private Supabase Storage, archives each original through a
streaming Cloudflare Worker — in a Cloudflare R2 bucket or a user-owned Google
Drive folder, your choice — and sends the derivative through
Google Vision SafeSearch before publication. Couples who trust their guests can
set `MODERATION_ENABLED=false` to skip SafeSearch entirely — photos are
auto-approved at finalization and show up in the gallery immediately, and no
Google Vision credentials are needed.

The UI and operational documentation are Polish-first. Technical documentation
is written in English so implementation agents can share precise contracts.

## Local prerequisites

- Node.js 24
- npm
- Docker Desktop for local Supabase
- Supabase CLI (`npx supabase`)
- Cloudflare account and Wrangler for the archive Worker
- Google Cloud project with the Vision API (unless `MODERATION_ENABLED=false`)
- For `ARCHIVE_BACKEND=drive`: a Google OAuth desktop client with `drive.file`

Copy `.env.example` to `.env.local` and replace every placeholder. Never commit
`.env.local`, `.dev.vars`, files under `private/`, or `oauth-output/`.

```powershell
npm install
npx supabase start
npx supabase db reset
npm run dev
```

Quality checks:

```powershell
npm run check
npm run test:e2e
```

## Integration order

1. Create an EU Supabase project and link it with `npx supabase link`.
2. Apply `npx supabase db push`; confirm the `gallery` bucket is private.
3. Add the project URL, publishable key, and secret key to Vercel.
4. Create a Google Cloud project with billing and enable the Vision API.
5. Create a Vision-only service account and copy its project ID, email, and
   private key into Vercel secrets. (Skip steps 4–5 entirely when running with
   `MODERATION_ENABLED=false`.)
6. Choose where originals live and set `ARCHIVE_BACKEND` to match, in both
   `workers/archive/wrangler.jsonc` and Vercel:

   **`r2` (default).** Create the bucket in the same Cloudflare account and
   point `r2_buckets[0].bucket_name` at it. No Google involvement, no consent
   screen, no refresh token to renew. Deleting an original is immediate and
   final.

   **`drive`.** Originals land in a folder you own and can browse from any
   Drive client, and deleting only trashes them — Drive keeps a trashed file
   for 30 days. Costs an OAuth consent screen and a refresh token that expires
   after seven days unless the consent app is published to Production. Create
   a desktop OAuth client with the `drive.file` scope, set
   `GOOGLE_DRIVE_OAUTH_CLIENT_ID` and `GOOGLE_DRIVE_OAUTH_CLIENT_SECRET`, then
   run `npm run drive:bootstrap`. Remove the `r2_buckets` block from
   `wrangler.jsonc` and copy the four values from the ignored
   `oauth-output/drive-oauth.json` into Cloudflare secrets:

   ```powershell
   cd workers/archive
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_ID
   npx wrangler secret put GOOGLE_OAUTH_CLIENT_SECRET
   npx wrangler secret put GOOGLE_OAUTH_REFRESH_TOKEN
   npx wrangler secret put GOOGLE_DRIVE_FOLDER_ID
   ```

7. Set the shared archive secret on the Worker:

   ```powershell
   cd workers/archive
   npx wrangler secret put ARCHIVE_TOKEN_SECRET
   ```

8. Set `ALLOWED_ORIGIN` in `wrangler.jsonc`, deploy the Worker, then configure
   both server and public Worker URLs in Vercel.
9. Attach `wedding.pawel.space` to Vercel and use the DNS record Vercel provides.
10. Set the production origin, deletion-contact email, and three independent
    random secrets for guest entry/session and admin entry/session.
11. Generate private QR files with `npm run qr:generate`. Print the guest QR;
    protect the admin QR like a shared administrator password.

See [integration setup](docs/integrations.md) and the
[event runbook](docs/operations.md) before production deployment.

## Architecture map

- `proxy.ts`: token exchange, clean redirects, optimistic route checks.
- `app/api/uploads`: capability issuance and verified finalization.
- `app/api/gallery`: protected approved-photo pagination and statistics.
- `app/api/admin`: moderation, reconciliation, and deletion operations.
- `workers/archive`: streaming original upload and archive lifecycle; one
  backend per deployment (`src/r2.ts`, `src/drive.ts`).
- `app/pokaz` + `app/admin/pokaz`: live slideshow and its slide editor.
- `workers/slideshow-live`: PartyServer room for ephemeral reactions and
  comments during the slideshow (`docs/slideshow.md`).
- `supabase/migrations`: tables, enums, indexes, RLS, and private bucket.
- `docs/tasks`: dependency-ordered briefs for planning/implementation agents.

## Recovery

- Lost guest QR: rotate `GUEST_ENTRY_TOKEN` and regenerate/print the code.
- Lost admin QR: rotate both `ADMIN_ENTRY_TOKEN` and
  `ADMIN_SESSION_SECRET`; all existing admin cookies then stop working.
- Invalid Drive refresh token (`ARCHIVE_BACKEND=drive`): rerun
  `npm run drive:bootstrap` and replace the Worker secret.
- Supabase/archive partial upload: use “Znajdź w archiwum” from `/admin`.
- Partial deletion: the admin queue retains the error and permits retry.
