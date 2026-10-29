# Architecture

## One deployment, many weddings

One Cloudflare Worker (Next.js through OpenNext), one D1 database, two R2
buckets, declared in `alchemy.run.ts`. A wedding is a row in `sites`,
served at `<slug>.<PLATFORM_HOST>` or its custom domain. `lib/sites.ts`
turns the Host header into a site; every handler starts there and every D1
query filters on `site_id`. The platform host itself (`PLATFORM_HOST`) is
the owner console at `/konto`: magic-link login, site creation, QR codes,
theme, billing. Owners never receive guest-side cookies and guest cookies
never open the console.

## Trust boundaries

Cookies are HS256 JWTs under `__Host-` names. One `SESSION_SECRET` derives a
key per site from `site.id` and `session_key_version`, so rotating one
site's version logs out that site alone. A guest cookie opens that site's
private gallery and upload endpoints; an admin cookie opens its moderation
queue and slide editor; an owner cookie opens the console for the account's
own sites. No cookie grants anything in D1 or R2 directly: the Worker holds
the bindings, and each handler decides.

Derivatives live in the private `GALLERY` bucket under
`sites/<siteId>/<storage_path>`. Nothing is served from a bucket URL. A
browser writes a derivative through `PUT /api/uploads/:id/derivative`
(guest cookie, ownership of the photo row) and reads one through
`GET /api/photos/:id/image` (guest or admin cookie; guests only see what
the gallery rule allows).

Originals go through `workers/archive`, the only holder of archive
credentials: an R2 binding to the originals bucket (Infrequent Access, keys
`sites/<siteId>/originals/<photoId>__<filename>`) or, for a self-hoster, a
Drive refresh token, per `ARCHIVE_BACKEND`. The app mints ten-minute HMAC
JWTs scoped to one photo, one site, one origin, one operation. The Worker's
CORS reflects exactly the origin the token names, so a site on a custom
domain works without the Worker keeping a list. Worker receipts use the same
secret, expire in 24 h, bind archive key and byte length to the photo UUID.
The app stores that key as `archive_key` and never learns which backend
produced it.

Vision credentials and the Stripe keys are Worker secrets. Moderation reads
the derivative server-side; Google never gets a URL. Stripe learns the owner's
e-mail and a site id, never a photo.

## Upload sequence

1. Guest consents, submits metadata for 1-10 originals.
2. Next creates a batch + pending photo rows under the site. A trial site
   stops at `TRIAL_PHOTO_LIMIT`.
3. Next returns, per photo, its UUID and an archive-upload JWT.
4. Browser builds an EXIF-free JPEG derivative and a blur placeholder,
   `PUT`s the derivative to `/api/uploads/:id/derivative`, and streams the
   original to the archive Worker. Max two originals in flight.
5. Worker streams the original into the archive under the site prefix (or a
   resumable Drive session) and answers with a signed receipt.
6. Browser posts derivative metadata + the receipt to finalize.
7. Finalize checks the derivative in the bucket and the receipt, saves their
   independent states, responds.
8. SafeSearch runs after the response when the site has moderation on and
   Vision is configured; otherwise the photo is `approved` at once with a
   system moderation event. Storage usage is re-reported to billing.
9. Only approved + hot-uploaded rows reach the gallery.

## Failure policy

- Hot failure -> hidden, retryable, never published.
- Archive failure -> derivative can still be moderated and published. Admin
  queue reconciles by site + photo id: R2 prefix listing under
  `sites/<siteId>/originals/<photoId>__`, or Drive `appProperties` search on
  `photoId` and `siteId`.
- Vision failure -> `review_required`, hidden. Admin retries or approves.
- Flagged -> hidden until an admin decides.
- Partial delete -> keep row + error for retry. Completed deletion keeps the
  row too, as an audit tombstone. Only the derivative is removed and the
  original deleted: permanent on R2, 30-day trash on Drive. The Worker
  refuses to delete a key outside the token's site and photo prefix.

No operation treats a missing external response as success.
