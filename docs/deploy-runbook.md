# Wedding-day deploy runbook

Written 8 Aug 2026, ~4 h before the event. Target: guests scan a QR, upload
photos, and the slideshow runs at the reception.

## Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| Originals archive | **Cloudflare R2** (`ARCHIVE_BACKEND=r2`) | Same account as the Workers. No OAuth consent screen, no 7-day refresh-token expiry, no GCP project. Drive stays available as the other backend for anyone who wants a browsable folder. |
| Moderation | **Off** (`MODERATION_ENABLED=false`) | Photos appear instantly. No Vision credentials. Hide anything unwanted from `/admin` after the fact. |
| Priority | Slideshow first | Gallery + `/pokaz` + live reactions are the must-have; archive is second. |

## Live values

| Thing | Value |
|---|---|
| Production origin | `https://wianki.vercel.app` |
| Vercel project | `hasparus-projects/wianki` |
| R2 bucket | `wedding-originals` |
| Workers | `wedding-archive`, `wedding-slideshow-live` |
| Generated secrets | `.secrets.deploy` in the repo root, git-ignored, mode 600 |

## Credentials

Everything lives in `.secrets.deploy` (git-ignored, mode 600). Human-facing:

| What | Value |
|---|---|
| Gallery | `https://wianki.vercel.app` |
| Guest passphrase | `GUEST_ACCESS_PASSPHRASE` |
| Admin passphrase | `ADMIN_ACCESS_PASSPHRASE` (at `/login`, lands on `/admin`) |
| Join link on the stage | `wianki.vercel.app/p/GUEST_JOIN_CODE` |
| Printable QR codes | `private/qr/guest-qr.png`, `private/qr/admin-qr.png` |

## Loading old photos

```bash
npm run photos:upload -- ~/path/to/photos --dry-run   # check the selection
npm run photos:upload -- ~/path/to/photos             # send it
```

Drives the same endpoints a phone does. Derivative goes to Supabase EXIF-free,
original goes to R2 with metadata intact. Then curate at `/admin/pokaz`.

## Progress

- [x] Drive → R2 swap, full gate green (54 app + 19 worker tests, clean build)
- [x] Vercel project created, framework pinned, production alias claimed
- [x] 13 of 18 production env vars set
- [x] Both Workers' `ALLOWED_ORIGIN` set to the production origin
- [x] Supabase project `wianki` (Frankfurt), 3 migrations applied
- [x] Both Workers deployed with secrets; R2 bucket live
- [x] All 20 production env vars set
- [x] End-to-end verified: upload → Supabase derivative → R2 original → gallery row
- [x] Passphrase admin login, tested in production
- [x] Bulk upload CLI, verified against the real pipeline
- [x] QR codes generated; test photos purged

## Order of operations

Dependencies force this order: Supabase keys are needed by Vercel, the Worker
URLs are needed by Vercel, and `ALLOWED_ORIGIN` on both Workers needs the final
production origin. So the origin is decided first, Workers deploy before the
app, and the app deploys last.

### 1. Code: add R2 alongside Drive, select R2

- Put both archives behind one `ArchiveBackend` contract in `workers/archive`
  (`src/r2.ts`, `src/drive.ts`); `ARCHIVE_BACKEND` picks one per deployment and
  refuses to start half-configured.
- Rename `drive_file_id` → `archive_key` end to end — a Drive file id is an
  archive key too. Nothing is deployed yet, so the initial migration is edited in
  place rather than layering a rename migration on a schema that has never existed.
- `npm run check` must pass before anything is deployed.

### 2. Supabase

```bash
npx supabase login            # interactive, browser
npx supabase link --project-ref <ref>
npx supabase db push
```

Verify: three tables with RLS enabled, `gallery` bucket **private**, 500 KiB limit.

Collect: project URL, publishable key, secret key.

### 3. Cloudflare

```bash
npx wrangler login            # interactive, browser
npx wrangler r2 bucket create wedding-originals

cd workers/archive
npx wrangler secret put ARCHIVE_TOKEN_SECRET
npx wrangler deploy

cd ../slideshow-live
npx wrangler secret put LIVE_TOKEN_SECRET
npx wrangler deploy
```

`ALLOWED_ORIGIN` lives in each `wrangler.jsonc` and must equal the exact
production origin, scheme included, no trailing slash.

### 4. Vercel

Secrets are generated locally with `openssl rand -base64 32`, never reused
between roles. Set every value from `.env.example` in **Production**, then:

```bash
vercel link
vercel --prod
```

### 5. Verify

- `/login` reachable, passphrase works.
- Guest QR grants a session and lands on the gallery.
- Upload a real photo from a phone: appears in the gallery, object lands in R2.
- `/pokaz` plays; admin device shows "Prowadzisz"; a second device follows.
- Reaction and comment bubbles cross both screens.
- Join QR in the corner scans to a working session.

### 6. QR codes

```bash
npm run qr:generate          # writes to private/, git-ignored
```

Print the guest QR. The admin QR is a shared password — keep it with the couple.

## Day-of recovery

| Symptom | Action |
|---|---|
| Photo shouldn't be public | `/admin` → Ukryj z galerii. Instant. |
| Uploads fail, gallery fine | Archive Worker issue. Guests unaffected; reconcile later from `/admin`. |
| Slideshow won't sync | Any admin device reopening `/pokaz` reclaims the show. Presenter disconnect resets the room. |
| Live layer dead | Slideshow still plays locally on every device. Reactions silently disabled. |
| Guest QR leaked | Rotate `GUEST_ENTRY_TOKEN` in Vercel, redeploy, reprint. |
| Join QR photographed | Rotate `GUEST_JOIN_CODE` only. Printed table QRs keep working. |

## Known gaps, accepted

- Vision moderation code remains in the tree, unused behind the flag. Post-wedding cleanup.
- Originals uploaded before the archive Worker is live are not recoverable.
