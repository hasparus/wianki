# Event operations

## One month before

- The site's plan is active (owner console); a trial site stops accepting
  uploads when it lapses.
- Reread the Polish privacy copy and the site's deletion address.
- Print a fresh guest QR from the owner console. Print and store the admin QR
  safely.
- Upload, approve, view, reconcile, delete a few throwaway images.

## 48 hours before

- `npm run check`.
- Safari on a current iPhone, Chrome on a current Android.
- Weak network: interrupt an upload, retry.
- Cloudflare dashboard: Workers error rates and the R2 and D1 metrics for the
  stage. Vision quota if the site moderates.
- `npx alchemy deploy --stage prod` from `main` is a no-op when nothing
  changed; run it so you know the state matches the account.

## During the event

- Admin QR stays with the couple or one trusted helper.
- Watch the moderation and archive-error queues, not raw logs full of metadata.
- Vision down -> approve safe images by hand. Never make a bucket public.
- Moderation off -> photos publish instantly. Hide unwanted ones from the
  admin panel afterwards.
- Archive Worker down -> gallery keeps running, reconcile later from `/admin`.

## Historical gallery placeholders

New uploads store tiny JPEG blur placeholders. Photos uploaded before that
feature have none and can appear to paint progressively on slow connections.
Inspect the number of missing previews with
`node scripts/backfill-blur-placeholders.ts` (dry run), then run it with
`--apply`. It downloads only approved, EXIF-free derivatives from the private
gallery bucket into memory, stores the 8px preview, and can be rerun safely;
it does not touch originals. Never commit the local environment files or
downloaded photos.

## Recovery and rotation

Per-site secrets are rows in D1, edited from the owner console; platform
secrets are environment values redeployed with Alchemy.

| Leaked | Rotate |
| --- | --- |
| Guest entry QR | the site's guest entry token, reprint |
| Join code | the site's join code only. Printed table QRs survive |
| Admin QR | the site's admin entry token, then bump its session key version. Kills that site's cookies |
| Passphrase | the site's guest or admin passphrase in the owner console |
| `SESSION_SECRET` | new value, `alchemy deploy`. Everyone on every site signs in again |
| Archive token | `ARCHIVE_TOKEN_SECRET`, one deploy updates the app and the Worker together |
| Live slideshow token | `SLIDESHOW_LIVE_SECRET`, same |
| Cloudflare API token | new token in `.env` and GitHub secrets; running Workers are unaffected |

Never fix a failure by putting service credentials in the browser.
