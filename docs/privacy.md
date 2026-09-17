# Privacy decisions

- The couple controls the photos.
- Supabase holds private derivatives. R2 or the couple's Drive holds originals.
- Vision sees derivative bytes, and only when moderation is on.
- Derivatives are EXIF-stripped. Originals keep camera metadata.
- Random browser UUID only. No guest name, email, or IP.
- Every batch needs consent. The record stores the notice version.
- Photos stay until someone deletes them.
- The configured contact email handles deletion requests.
- Admin deletion removes derivative and original. Drive -> trash, recoverable
  until emptied. R2 -> immediate.
- Slideshow reactions and comments are never stored. They exist only in the
  room's memory while the show runs.

The couple reviews the production copy. This file records what the code does.
Not legal advice.
