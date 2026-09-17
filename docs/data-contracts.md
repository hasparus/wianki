# Data and HTTP contracts

## Status invariants

`hot_status`: `pending | uploaded | failed | deleted`
`archive_status`: `pending | uploaded | failed | trashed | deletion_error`
`moderation_status`: `pending | approved | flagged | review_required | rejected`

Gallery eligibility, exactly: `hot_status = uploaded AND moderation_status =
approved`.

## Guest APIs

**`POST /api/uploads/init`** — in `{ consent: true, files: [{name,type,size}] }`,
1-10 items, accepted image MIME, 25 MiB each. Out: batch UUID, and per item a
photo UUID, Storage path, signed upload token, archive-operation token.

**`POST /api/uploads/:photoId/finalize`** — in: derivative dimensions, type,
size, optional archive receipt, optional archive error. Checks ownership,
downloads the derivative, verifies size + receipt, saves both outcomes, returns
`moderation_status=pending`. SafeSearch continues after the response ->
`approved | flagged | review_required`. `MODERATION_ENABLED=false` -> returns
`approved` at once, skips SafeSearch, logs an `approved` event with actor
`system`. New clients send JPEG; WebP and PNG still accepted.

**`POST /api/uploads/:photoId/archive`** — `action=token` mints a fresh
archive-only capability after a failed archive upload. `action=complete`
verifies the new receipt, updates archive state only. Lets the same open
browser retry without duplicating the hot row.

**`GET /api/gallery`** — optional opaque cursor (last timestamp + UUID). Up to
25 approved items, one-hour signed read URLs, next cursor, approved-photo and
approximate-guest stats.

## Worker API

| Route | Token | Does |
| --- | --- | --- |
| `PUT /v1/archive/:photoId` | upload | streams the raw original in |
| `GET /v1/archive/:photoId` | reconcile | finds by photo UUID: `originals/<photoId>__` prefix on R2, `appProperties.photoId` on Drive |
| `DELETE /v1/archive/:photoId` | delete | removes it: permanent on R2, 30-day trash on Drive |

Failure statuses say which kind: 401 bad token, 403 wrong photo or origin, 400
bad claims, 404 nothing archived, 500 misconfigured deploy, 502 archive itself
failed. 500 and above log the detail and tell the browser only that the archive
is unavailable.

CORS allows exactly one configured origin.

## Admin API

**`GET /api/admin/photos`** — every actionable photo state, newest first,
optional opaque cursor. Fully deleted tombstones stay in Postgres for audit but
drop out once neither copy has a retryable action.

**`PATCH /api/admin/photos/:photoId`** — `approve | hide | retry_moderation |
reconcile_archive`.

**`DELETE /api/admin/photos/:photoId`** — removes derivative and original,
records partial failure, keeps the row as an audit and retry tombstone.

## Slideshow APIs

**`GET /api/slideshow/live`** — guest or admin cookie in, 12-hour HS256 room
token out, or `{ live: null }` when the live worker is unconfigured.

**`/api/admin/slides*`** — admin cookie + same origin, enforced by
`denyAdminRequest`. Reorder takes a full permutation of current slide ids;
anything else is 409.
