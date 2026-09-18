# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Wedding guests, on their own phones, during and shortly after the reception.
They arrive by scanning a shared QR code or by typing an invitation
passphrase — there are no named accounts and nobody signs up. A guest's job is
narrow and impatient: get in, drop the photos they just took, and see what
everyone else captured. Many are older, holding a drink, standing in low light.

A second, much smaller audience is the couple and whoever helps them: an
administrator entering through a separate private QR token for a 12-hour
session, working the moderation and recovery queues, and a presenter driving
the live slideshow from a laptop at the venue.

## Product Purpose

A private, Polish-first wedding photo gallery for one wedding. Guests upload
from their phones; the couple ends the night with every photo their guests
took, in one place, without anyone creating an account or handing over an email
address. Success is a guest who uploads without being taught how, and a couple
who still has the originals a decade later.

## Positioning

Anonymity is the mechanism, not a setting. An upload is never tied to a name,
an email, or an IP address, and the browser strips EXIF before anything leaves
the phone. At the same time nothing is lost: the untouched original streams
through a Cloudflare Worker to the couple's own archive (R2 or their Drive
folder) while the EXIF-free derivative goes to a private Supabase bucket — two
independent destinations, both verified before an upload is called finished.
A shared consumer album gives you one or the other, never both.

## Operating Context

One deployment serves exactly one wedding. Canonical production site of this
fork is `https://wesele.monwid-olechnowicz.com`.

Guest flow: QR or passphrase → signed guest cookie → privacy notice → gallery
with an upload panel. Photos only, at most 10 files per batch, 25 MiB per
original. The gallery shows uploaded and approved derivatives, newest first,
refreshed by hand — there is no Realtime and no background polling.

Admin flow: private QR token → `/admin` moderation and recovery queues —
approve, hide, retry moderation, reconcile archive, confirm deletion. Deletion
can half-fail, so both the Supabase side and the archive side stay retryable.

Evening flow: a live slideshow at `/pokaz`, curated from `/admin/pokaz`, run by
a PartyServer Durable Object. Guests send ephemeral reactions and comments that
float over the projected photo and are never persisted. The gallery itself has
no comments and no likes.

External services, none preconfigured: Supabase, Cloudflare Workers, R2 or
Google Drive, Google Vision SafeSearch, Vercel.

## Capabilities and Constraints

- Polish UI, mobile first, photos only. No video.
- Three independent statuses per photo: `hot_status`, `archive_status`,
  `moderation_status`. Gallery = `hot_status=uploaded` AND
  `moderation_status=approved`. That rule never changes.
- Private Supabase bucket; no public table or object policies.
- Moderation runs Vision SafeSearch on the derivative; with
  `MODERATION_ENABLED=false` uploads auto-approve and Vision is skipped.
- Admin entry is a bearer QR token, not a user account.
- V1 excludes video, comments, likes, face recognition, named accounts,
  Realtime, and background polling. The live slideshow is the one addition.
- No secret, OAuth output, generated QR, or real photo may enter Git.
- Next.js 16: `proxy.ts` rather than `middleware.ts`, async `cookies()` and
  route `params`, proxy does an optimistic check only, and every Server Action
  and Route Handler authorizes its own request.

## Brand Commitments

The couple is "Rosia & Piotrek"; that wordmark appears on the login screen and
at the top of the gallery. The voice is warm, plain, and second-person plural
Polish — it thanks guests rather than instructing them. The privacy promise is
part of the brand, not fine print, and is stated in guest-readable language.

No logo file, no photography of the couple, and no typographic identity are
supplied as fixed assets.

Binding visual constraints the user set for this redesign: an elegant
**black and white** interface — achromatic ink, paper, and greys — with muted
semantic red and green retained for error and success states, and
**Instrument Serif** as the display typeface. Guests' own photos stay in full
color and are the only color on screen.

## Evidence on Hand

Real content is the guests' photos and nothing else. There are no testimonials,
no press, no metrics, no customer logos, and no stock photography in the
repository; none may be invented. The only counts the interface may display are
the live `approvedPhotos` and `contributingGuests` figures from
`getGalleryStats()`. `public/` holds an icon and the photo-challenge prompts;
no real wedding photo is committed.

## Product Principles

1. **The photos are the product.** Every pixel of interface exists to get a
   guest's photo in and other guests' photos out. The chrome recedes.
2. **Anonymous by construction.** Never add a field, a log line, or a feature
   that could tie an upload to a person.
3. **One-handed, one-minute.** A guest on a phone, in the dark, half-drunk,
   completes the upload without reading instructions.
4. **Two destinations or it did not happen.** Derivative and original are
   verified independently; a half-finished upload stays visibly retryable.
5. **One wedding, one night.** Prefer the thing that works on the day over the
   thing that scales.

## Accessibility & Inclusion

Every interactive state keeps WCAG AA contrast and a visible focus ring. Touch
targets are at least 44px. Icon-only controls carry accessible names. Dialogs
close by button, backdrop, or Escape. Gallery images use empty `alt` — no
meaningful caption exists, so the surrounding button names the action. Reduced
motion is honored: decorative animation stops. There is no automatic dark mode.
