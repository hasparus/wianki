# Architecture

## Trust boundaries

Guest cookie opens the private gallery. Never grants DB permissions. Server
handlers use the Supabase secret key to mint single-object upload capabilities
and one-hour read URLs. The browser-visible publishable key has no useful
table or bucket policy.

The Worker is the only holder of archive credentials: an R2 binding or a Drive
refresh token, per `ARCHIVE_BACKEND`. Next mints ten-minute HMAC JWTs scoped to
one photo, one operation. Worker receipts use the same secret, expire in 24 h,
bind archive key and byte length to the photo UUID. The app stores that key as
`archive_key` and never learns which backend produced it.

Vision credentials live only in Vercel. Moderation reads the derivative
server-side. Google never gets a public URL.

## Upload sequence

1. Guest consents, submits metadata for 1-10 originals.
2. Next creates a batch + pending photo rows.
3. Next returns signed Supabase upload tokens + archive-operation JWTs.
4. Browser builds an EXIF-free JPEG derivative, uploads it alongside the
   original. Max two originals in flight.
5. Worker streams the original into the archive: R2 object under
   `originals/<photoId>__`, or a resumable Drive session.
6. Browser posts derivative metadata + Worker receipt to finalize.
7. Finalize checks both copies, saves their independent states, responds.
8. SafeSearch runs after the response, updates moderation on its own.
   `MODERATION_ENABLED=false` -> skipped, photo `approved`, system moderation
   event recorded.
9. Only approved + hot-uploaded rows reach the gallery.

## Failure policy

- Hot failure -> hidden, retryable, never published.
- Archive failure -> derivative can still be moderated and published. Admin
  queue reconciles by photo id: R2 prefix listing, or Drive
  `appProperties.photoId` search.
- Vision failure -> `review_required`, hidden. Admin retries or approves.
- Flagged -> hidden until an admin decides.
- Partial delete -> keep row + error for retry. Completed deletion keeps the
  row too, as an audit tombstone. Only the derivative is removed and the
  original deleted: permanent on R2, 30-day trash on Drive.

No operation treats a missing external response as success.
