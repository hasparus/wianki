# Event operations

## One month before

- Upgrade Supabase for the event month.
- Drive backend: consent app is Production, refresh token works.
- Reread the Polish privacy copy and the deletion address.
- Print a fresh guest QR. Print and store the admin QR safely.
- Upload, approve, view, reconcile, delete a few throwaway images.

## 48 hours before

- `npm run check`.
- Safari on a current iPhone, Chrome on a current Android.
- Weak network: interrupt an upload, retry.
- Vercel, Supabase, Vision, archive, Worker dashboards.
- Archive and Supabase capacity, Cloudflare error rates.

## During the event

- Admin QR stays with the couple or one trusted helper.
- Watch the moderation and archive-error queues, not raw logs full of metadata.
- Vision down -> approve safe images by hand. Never make the bucket public.
- `MODERATION_ENABLED=false` -> photos publish instantly. Hide unwanted ones
  from the admin panel afterwards.
- Archive down -> gallery keeps running, reconcile later.

## Historical gallery placeholders

New uploads store tiny JPEG blur placeholders. Photos uploaded before that
feature have none and can appear to paint progressively on slow connections.
After the blur placeholder migration has been applied, inspect the number of
missing previews with `node scripts/backfill-blur-placeholders.ts` (dry run),
then run `node scripts/backfill-blur-placeholders.ts --apply`. It downloads only
approved, EXIF-free derivatives from the private gallery bucket into memory,
stores the 8px preview, and can be rerun safely; it does not touch originals.
Never commit the local environment files or downloaded photos.

## Recovery and rotation

| Leaked | Rotate |
| --- | --- |
| Guest entry QR | `GUEST_ENTRY_TOKEN`, reprint |
| Join code | `GUEST_JOIN_CODE` only. Printed table QRs survive |
| Admin QR | `ADMIN_ENTRY_TOKEN` + `ADMIN_SESSION_SECRET`, redeploy, regenerate. Kills existing admin cookies |
| Passphrase | `GUEST_ACCESS_PASSPHRASE` or `ADMIN_ACCESS_PASSPHRASE` in Vercel |
| Archive token | shared archive secret, Vercel and Cloudflare together |
| OAuth revoked | rerun the bootstrap, replace the Worker refresh token |

Never fix a failure by putting service credentials in the browser.
