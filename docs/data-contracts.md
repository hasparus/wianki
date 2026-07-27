# Data and HTTP Contracts

## Status invariants

`hot_status`: `pending | uploaded | failed | deleted`

`archive_status`:
`pending | uploaded | failed | trashed | deletion_error`

`moderation_status`:
`pending | approved | flagged | review_required | rejected`

Gallery eligibility is exactly:
`hot_status = uploaded AND moderation_status = approved`.

## Guest APIs

### `POST /api/uploads/init`

Input: `{ consent: true, files: [{ name, type, size }] }`.

Limits: 1–10 items, accepted image MIME types, maximum 25 MiB each.

Output: batch UUID and, per item, photo UUID, Storage path, signed upload token,
and archive-operation token.

### `POST /api/uploads/:photoId/finalize`

Input: derivative dimensions/type/size, optional archive receipt, and optional
archive error. The handler verifies ownership, downloads the private derivative,
verifies its size and receipt, runs moderation, and returns the three outcomes.
Canvas-reencoded WebP, JPEG, and PNG derivatives are accepted.

### `POST /api/uploads/:photoId/archive`

`action=token` issues a fresh archive-only capability for a failed Drive upload.
`action=complete` verifies the new Worker receipt and updates only archive state.
This lets the same open browser retry its original without duplicating the hot
photo row.

### `GET /api/gallery`

Optional opaque cursor containing the last timestamp/UUID pair. Returns at most
25 approved items, one-hour signed read URLs, the next cursor, and
approved-photo/approximate-guest statistics.

## Worker API

`PUT /v1/archive/:photoId` accepts a raw original body and upload JWT.

`GET /v1/archive/:photoId` accepts a reconcile JWT and searches Drive by the
photo UUID stored in `appProperties`.

`DELETE /v1/archive/:photoId` accepts a delete JWT and trashes the Drive file.

Browser CORS permits only the configured exact application origin.

## Admin API

`GET /api/admin/photos` returns every actionable photo state, newest first, with
an optional opaque cursor for older records. Fully deleted tombstones stay in
Postgres for audit but are omitted once neither copy has a retryable action.
This lets an administrator retract an approved photo as well as handle flagged,
failed, and partially deleted items.

`PATCH /api/admin/photos/:photoId` supports `approve`, `hide`,
`retry_moderation`, and `reconcile_archive`.

`DELETE /api/admin/photos/:photoId` removes the derivative, trashes the
original, and records any partial failure. It retains the photo row as an audit
and retry tombstone instead of deleting it from Postgres.
