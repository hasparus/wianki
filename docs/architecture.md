# Architecture

## Trust boundaries

The guest cookie grants access to the private gallery but never direct database
permissions. Next.js server handlers use the Supabase secret key to issue
single-object upload capabilities and one-hour read URLs. The browser-visible
publishable key has no useful table or bucket policy.

The Cloudflare Worker is the only component with the Google Drive refresh token.
Next.js creates ten-minute HMAC JWTs scoped to one photo and one operation.
Worker receipts use the same secret, a 24-hour expiry, and bind the Drive file
ID and byte length to the photo UUID.

Google Vision credentials exist only in Vercel. Moderation reads the private
derivative server-side; no public image URL is given to Google.

## Upload sequence

1. Guest consents and submits metadata for 1–10 originals.
2. Next.js creates a batch and pending photo rows.
3. Next.js returns signed Supabase upload tokens and archive-operation JWTs.
4. Browser creates an EXIF-free JPEG derivative and uploads it alongside the
   original, with at most two originals in flight.
5. Worker streams the original to a resumable Drive session.
6. Browser sends the derivative metadata and Worker receipt to finalization.
7. Finalization validates both private copies, persists their independent
   states, and responds as soon as the upload is safely accounted for.
8. SafeSearch runs after the response and updates moderation independently.
   With `MODERATION_ENABLED=false`, finalization skips SafeSearch and marks the
   photo `approved` immediately, recording a system moderation event.
9. Only approved, hot-uploaded rows appear in the manually refreshed gallery.

## Failure policy

- Hot failure: hidden and retryable; no publication.
- Archive failure: derivative may still be moderated/published; admin queue
  attempts Drive reconciliation by `appProperties.photoId`.
- Vision failure: `review_required`, hidden, admin may retry or approve.
- Flagged: hidden until explicit admin decision.
- Partial delete: retain a tombstone-like row and error for safe retry. Completed
  deletion also retains the row as an audit tombstone; only the Supabase Storage
  derivative is removed and the Drive original is moved to trash.

No operation treats a missing external response as success.
