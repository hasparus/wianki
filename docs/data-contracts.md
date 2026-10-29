# Data and HTTP contracts

## Schema

`db/migrations/*.sql` is the only source of truth for the D1 schema; the
current one is `0001_platform.sql`. Tables: `accounts`, `login_tokens`,
`sites`, `upload_batches`, `photos`, `moderation_events`,
`slideshow_slides`, `slideshow_settings`, `billing_events`. Every row that
belongs to a wedding carries `site_id`. Timestamps are ISO 8601 UTC text
with millisecond precision. Status vocabularies are check constraints.

## Status invariants

`hot_status`: `pending | uploaded | failed | deleted`
`archive_status`: `pending | uploaded | failed | trashed | deletion_error`
`moderation_status`: `pending | approved | flagged | review_required | rejected`
`plan_status` (site): `trial | active | past_due | canceled`

Gallery eligibility, exactly: `hot_status = uploaded AND moderation_status =
approved`. Uploads are accepted while `plan_status` is `trial` or `active`;
a trial stops at 100 photos.

## Site resolution

The Host header decides. `PLATFORM_HOST` is the console; a single label
below it is a site by slug; anything else is a custom domain. A request on a
site host whose site does not exist is 404. Every site API below also checks
`Origin` against the site's canonical origin.

## Entry APIs (site host)

**`GET /api/auth/enter?token=…&next=/`** — exchanges a guest entry token for
a guest cookie, or (with `next=/admin`) an admin entry token for an admin
cookie, then redirects to `next`. `?code=…` exchanges the slideshow join code
for a guest cookie and redirects to `/pokaz`. While the site's open house
(`guest_open_until`) is on, a visit without a token mints a guest cookie.
Wrong secrets redirect without a cookie.

**`POST /api/auth/guest`** — form field `passphrase`. The admin passphrase
yields the admin cookie and `{ redirect: "/admin" }`; the guest passphrase
the guest cookie and `{ redirect: "/" }`; anything else 401, identically.

## Guest APIs (guest cookie)

**`POST /api/uploads/init`** — in `{ consent: true, files: [{name,type,size}] }`,
1-10 items, accepted image MIME, 25 MiB each. Out: `batchId` and per item
`{ photoId, archiveToken }`. 402 when a trial site is full, 403 when the
site no longer accepts uploads.

**`PUT /api/uploads/:photoId/derivative`** — raw body, `Content-Type` one of
`image/jpeg | image/webp | image/png`, at most 500 KiB. The photo must be the
caller's and still `pending` or `failed` (409 otherwise). Stores the
derivative at `sites/<siteId>/<storage_path>` in the private gallery bucket.

**`POST /api/uploads/:photoId/finalize`** — in: derivative dimensions, type,
size, optional archive receipt, optional archive error, optional blur
placeholder (`blurDataUrl`: a JPEG data URL of at most 4096 characters, built
in the browser the way `next/image` builds one for a static import, 8px long
edge at quality 70). Checks ownership, reads the derivative back from the
bucket, verifies size + receipt, saves both outcomes. Returns
`moderation_status=pending` when the site moderates and Vision is configured,
and SafeSearch continues after the response -> `approved | flagged |
review_required`; otherwise returns `approved` at once and logs an
`approved` event with actor `system`. A placeholder that is not a small JPEG
data URL is dropped, never a reason to reject the photo.

**`POST /api/uploads/:photoId/archive`** — `action=token` mints a fresh
archive-only capability after a failed archive upload. `action=complete`
verifies the new receipt, updates archive state only. Lets the same open
browser retry without duplicating the hot row.

**`GET /api/gallery`** — optional opaque cursor (last timestamp + UUID). Up to
25 approved items, each with `imageUrl` (`/api/photos/:id/image`), stored
dimensions and its blur placeholder (`blurDataUrl`, null for photos imported
without one), next cursor, approved-photo stats.

**`GET /api/photos/:photoId/image`** — streams the derivative. Guest cookie:
only gallery-eligible photos. Admin cookie: any `uploaded` photo of the site,
because the queue has to show what it decides on. `private, max-age=3600`,
ETag, never a shared cache.

**`GET /api/slideshow/live`** — guest or admin cookie in; `{ live: { host,
party, room, token, role } }` out, or `{ live: null }` when the live worker
is unconfigured. `room` is the site id.

## Archive Worker API

Token claims, signed by the app with `ARCHIVE_TOKEN_SECRET` (HS256, audience
`wedding-archive`, 10 minutes):

```
{ photoId, siteId, origin, operation: "upload" | "reconcile" | "delete",
  filename?, contentType?, size?,      // upload
  archiveKey? }                        // delete
```

`siteId`: 1-64 characters of `[A-Za-z0-9-]`. `origin`: an https origin, or
http on localhost, with no path. Both are required on every operation.

| Route | Token | Does |
| --- | --- | --- |
| `PUT /v1/archive/:photoId` | upload | streams the raw original in, under `sites/<siteId>/originals/<photoId>__<filename>` |
| `GET /v1/archive/:photoId` | reconcile | finds by site + photo: that prefix on R2, `appProperties.photoId` + `siteId` on Drive |
| `DELETE /v1/archive/:photoId` | delete | removes it: permanent on R2, 30-day trash on Drive; the key must sit under the token's site and photo prefix |

Receipt, same secret, 24 hours: `{ kind: "receipt", photoId, archiveKey,
size }`. The app verifies `photoId` and `size` against its row.

Origin policy: an authenticated request's `Origin`, when present, must equal
the token's `origin` claim; the response reflects exactly that origin with
`Vary: Origin`. Server-to-server calls from the app send no `Origin`. The
preflight carries no token, so it is answered for the platform host, its
single-label subdomains and any https origin (custom domains), and for
plain-http localhost in development; it unlocks nothing by itself.

Failure statuses say which kind: 401 bad token, 403 wrong photo or origin,
400 bad claims or a key outside the site prefix, 404 nothing archived, 500
misconfigured deploy, 502 archive itself failed. 500 and above log the
detail and tell the browser only that the archive is unavailable.

## Admin API (admin cookie + same origin, `denyAdminRequest`)

**`GET /api/admin/photos`** — every actionable photo state of the site,
newest first, optional opaque cursor. Fully deleted tombstones stay in D1
for audit but drop out once neither copy has a retryable action. Items carry
`originalFilename` and the three statuses.

**`PATCH /api/admin/photos/:photoId`** — `approve | hide | retry_moderation |
reconcile_archive`. `retry_moderation` is 409 without Vision.

**`DELETE /api/admin/photos/:photoId`** — removes derivative and original,
clears the blur placeholder even on partial failure, records that failure,
and keeps the row as an audit and retry tombstone.

**`GET /api/admin/slides`** — the deck in order. **`POST`** appends either
`{ photoIds }` (eligible, not yet used) or `{ title, subtitle? }` (a text
slide). **`PATCH`** `{ order }` reorders: a full permutation of the current
slide ids, anything else 409. **`PATCH /api/admin/slides/:slideId`** edits a
text slide's title and subtitle (photo slides carry none). **`DELETE
/api/admin/slides/:slideId`** removes one. **`GET /api/admin/slides/photos`**
is the picker: a gallery page. **`PATCH /api/admin/slides/settings`**
`{ slideSeconds }`, 2-10.

## Live Worker (`workers/slideshow-live`)

Token claims, signed by the app with `SLIDESHOW_LIVE_SECRET` (HS256, audience
`wedding-slideshow-live`, 12 hours): `{ role: "guest" | "admin", room,
origin }`. The WebSocket to `/parties/slideshow-party/<room>?token=…` is
admitted when the token verifies, its `room` equals the room in the path and
the `Origin` header equals its `origin`. The role is bound to the
connection; nothing is persisted.

## Owner APIs (platform host)

**`POST /api/auth/owner/request`** — `{ email }`, same origin. Sends a magic
link; the answer is `{ ok: true }` whether or not the address has an account.
With `SIGNUP_ENABLED=false` unknown addresses get the same quiet answer and
no token. Without e-mail configured the link comes back as `devLink`.
**`GET /api/auth/owner/verify?token=…`** — a valid, unused token becomes a
30-day owner cookie and a redirect to `/konto`; anything else redirects to
`/konto/login?error=expired`. **`POST /api/auth/owner/logout`** — clears it.

Owner cookie + same origin (`denyOwnerRequest`); a site that is not the
account's is 404:

**`POST /api/konto/sites`** — creates a site; out `{ site: { id, slug,
title, origin } }`, 201.
**`PATCH /api/konto/sites/:siteId`** — settings (title, date, passphrases,
moderation, open house, join code, custom domain, contact e-mail).
**`POST /api/konto/sites/:siteId/rotate`** — `{ which: "guest" | "admin" }`
issues a new entry token and returns the new links; the admin rotation logs
every admin device out.
**`PUT /api/konto/sites/:siteId/theme`** — `{ theme }` validated by
`lib/theme.ts`; out the CSS the site will render.
**`POST /api/billing/checkout`** — `{ siteId }`; a Stripe Checkout URL for
the yearly plan plus metered overage. 409 when billing is unconfigured or
the site is already paid. **`POST /api/billing/portal`** — `{ siteId }`;
the billing portal URL. **`POST /api/billing/webhook`** — Stripe-signed,
no cookie; applies subscription state to `plan_status`, idempotent through
`billing_events`.
