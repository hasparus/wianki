# Privacy decisions

- The couple controls the photos; the owner account controls the site.
- Derivatives live in a private R2 bucket, originals in a second private R2
  bucket (or, on a self-hosted deployment, the couple's Drive). Both buckets
  are created in Cloudflare's EU jurisdiction, so object data stays in the
  EU; D1 is placed in Western Europe. Nothing is served from a bucket URL:
  every read goes through a handler that checks a cookie.
- Every row belongs to one site. A site's cookies are keyed by its own
  session version, so one site can be logged out without touching another.
- Vision sees derivative bytes, and only when the site has moderation on.
- Derivatives are EXIF-stripped. Originals keep camera metadata.
- Random browser UUID only. No guest name, email, or IP.
- Every batch needs consent. The record stores the notice version.
- Photos stay until someone deletes them.
- The site's configured contact email handles deletion requests.
- Admin deletion removes derivative and original. Drive -> trash, recoverable
  until emptied. R2 -> immediate.
- Owners: an e-mail address, magic-link tokens stored as hashes, Stripe
  customer and subscription ids. Stripe never sees a photo.
- Slideshow reactions and comments are never stored. They exist only in the
  room's memory while the show runs; one room per site.

The couple reviews the production copy. This file records what the code does.
Not legal advice.
