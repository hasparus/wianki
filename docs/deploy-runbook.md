# Wedding-day deploy runbook

Written 8 Aug 2026, about 4 h before the event. Goal: guests scan a QR, upload
photos, slideshow runs at the reception.

## Decisions taken

| Decision | Choice | Consequence |
|---|---|---|
| Originals archive | **Cloudflare R2** (`ARCHIVE_BACKEND=r2`) | Same account as the Workers. No OAuth consent screen, no 7-day refresh-token expiry, no GCP project. Drive stays available as the other backend for anyone who wants a browsable folder. |
| Moderation | **Off** (`MODERATION_ENABLED=false`) | Photos appear instantly. No Vision credentials. Hide anything unwanted from `/admin` after the fact. |
| Priority | Slideshow first | Gallery, `/pokaz`, live reactions are the must-have. Archive second. |

## Live values

| Thing | Value |
|---|---|
| Production origin | `https://wianki.vercel.app` (this fork's deploy, not the canonical `wedding.pawel.space`) |
| Vercel project | `hasparus-projects/wianki` |
| R2 bucket | `wedding-originals` |
| Workers | `wedding-archive`, `wedding-slideshow-live` |
| Generated secrets | `.secrets.deploy` in the repo root, git-ignored, mode 600 |

## Credentials

Never in this file. Every value lives in `.secrets.deploy` (git-ignored, mode
600) and in the Vercel and Cloudflare dashboards.

| What | Where |
|---|---|
| Gallery | `https://wianki.vercel.app` |
| Guest passphrase | `GUEST_ACCESS_PASSPHRASE` |
| Admin passphrase | `ADMIN_ACCESS_PASSPHRASE`, entered at `/login`, lands on `/admin` |
| Join link on the stage | `/p/<GUEST_JOIN_CODE>` |
| Printable QR codes | `private/qr/guest-qr.png`, `private/qr/admin-qr.png` |

## Loading old photos

```bash
npm run photos:upload -- ~/path/to/photos --dry-run   # check the selection
npm run photos:upload -- ~/path/to/photos             # send it
```

Same endpoints a phone hits. Derivative to Supabase, EXIF stripped. Original to
R2, metadata intact. Curate afterwards at `/admin/pokaz`.

## Progress

- [x] R2 backend added beside Drive, R2 selected, full gate green
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

Dependencies force the order. Vercel needs Supabase keys and Worker URLs. Both
Workers need the final origin for `ALLOWED_ORIGIN`. So: decide the origin,
deploy Workers, deploy the app last.

### 1. Code: add R2 alongside Drive, select R2

- Both archives behind one `ArchiveBackend` contract in `workers/archive`
  (`src/r2.ts`, `src/drive.ts`). `ARCHIVE_BACKEND` picks one per deployment and
  refuses to start half-configured.
- Rename `drive_file_id` to `archive_key` end to end. A Drive file id is an
  archive key too. Nothing is deployed yet, so the initial migration is edited
  in place instead of layering a rename onto a schema that never existed.
- `npm run check` green before anything deploys.

### 2. Supabase

```bash
npx supabase login            # interactive, browser
npx supabase link --project-ref <ref>
npx supabase db push
```

Verify: three tables with RLS on, `gallery` bucket private, 500 KiB limit.
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

`ALLOWED_ORIGIN` lives in each `wrangler.jsonc`. Exact origin, scheme
included, no trailing slash.

### 4. Vercel

Secrets generated locally with `openssl rand -base64 32`, never reused across
roles. Set every `.env.example` value in Production, then:

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

Print the guest QR. The admin QR is a shared password. Keep it with the couple.

## Day-of recovery

| Symptom | Action |
|---|---|
| Photo shouldn't be public | `/admin` → Ukryj z galerii. Instant. |
| Uploads fail, gallery fine | Archive Worker issue. Guests unaffected; reconcile later from `/admin`. |
| Slideshow won't sync | Any admin device reopening `/pokaz` reclaims the show. A presenter disconnect ends the live show but keeps the saved tempo. |
| Live layer dead | Slideshow still plays locally on every device. Reactions silently disabled. |
| Guest QR leaked | Rotate `GUEST_ENTRY_TOKEN` in Vercel, redeploy, reprint. |
| Join QR photographed | Rotate `GUEST_JOIN_CODE` only. Printed table QRs keep working. |

## Known gaps, accepted

- Vision moderation code sits in the tree unused behind the flag. Clean up after the wedding.
- Originals uploaded before the archive Worker went live are not recoverable.
