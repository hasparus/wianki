# Wianki agent guide

## Project in one minute

Private Polish-first wedding photo galleries, sold as a product. One
Cloudflare deployment (Next.js on Workers through OpenNext, D1, two R2
buckets, Durable Objects; all declared in `alchemy.run.ts` with Alchemy)
serves many weddings. A wedding is a site: `<slug>.<PLATFORM_HOST>` or a
custom domain, resolved from the Host header, with every D1 row and R2 key
under its `site_id`. Owners sign in by magic link to the console at
`/konto`: create a site, print its QR codes, pick a theme, pay. $49/yr per
site with metered storage overage through Stripe; a trial site stops at 100
photos.

On a site: guest enters by shared QR token or invitation passphrase ->
signed guest cookie -> privacy notice -> uploads from phone. No named
accounts. Never tie an upload to name, email, or IP.

Per photo: browser builds EXIF-free derivative -> `PUT
/api/uploads/:id/derivative` -> private gallery bucket under
`sites/<siteId>/`. Original streams through `workers/archive` -> R2 under
`sites/<siteId>/originals/` (`ARCHIVE_BACKEND=r2`, default) or a
self-hoster's Drive folder (`=drive`). Finalize verifies both, then Vision
SafeSearch checks the derivative when the site has moderation on and Vision
is configured; otherwise auto-approve.

Gallery shows uploaded + approved derivatives only, newest first, through
`GET /api/photos/:id/image`. That rule never changes.

Admin enters by the site's private QR token or admin passphrase, 12-hour
signed cookie. `/admin` = moderation and recovery queues: approve, hide,
retry moderation, reconcile archive, confirm deletion. Deletion can
half-fail, so derivative deletion and archive removal stay retryable.

This fork began as one wedding on Supabase + Vercel; upstream still runs
that at `https://wedding.pawel.space`. `scripts/export-supabase.ts` moves
such a deployment into a site.

V1 excludes video, comments, likes, face recognition, named guest accounts,
Realtime. The gallery polls its first page every ten seconds and folds in
what is new. Older pages arrive as the guest scrolls, never by button. The
gallery is a full-viewport-width horizontal rail that fills the remainder of
one dynamic viewport below its controls: guests swipe sideways and pinch to
change how many rows share that stable height without moving the page
around; plain minus/plus icons provide the same zoom for non-touch input.
Density changes use explicit, column-major plate geometry. Motion crossfades
the complete old and new layout layers without scaling or moving individual
plates. Button zoom anchors the nearest middle photo; a pinch anchors its own
focal point. Scroll offset is corrected before paint, and the outgoing layer
is counter-shifted so the old layout stays still during the crossfade.
Polling reserves complete logical columns for new photos and anchors the
first visible plate, preventing existing photos from changing rows or
shifting in the viewport. Never hand placement to CSS Grid reflow or animate
each plate between row levels. Every plate blurs up from a stored 8px
placeholder. It is DOM, not WebGL, on purpose: a WebGL grid was measured and
lost on time to first plates, texture stalls and memory. One addition on
top: live slideshow (`/pokaz`, editor `/admin/pokaz`, worker
`workers/slideshow-live` on PartyServer Durable Objects, one room per
site). Anonymous ephemeral reactions and comments, never persisted. Gallery
still has no comments or likes. See `docs/slideshow.md`.

External services, none preconfigured: Cloudflare (Workers, D1, R2, Durable
Objects, Email Sending for magic links), Stripe (billing), Vision
(moderation). Follow `README.md`, `docs/deploy.md`, `docs/integrations.md`,
`docs/operations.md`.

Start here, then read only the source and the one doc your task needs.
`docs/architecture.md` = request flow. `docs/data-contracts.md` = persisted
states and every API.

## Next.js 16 rule

Not the Next.js in your training data. Read the matching guide in
`node_modules/next/dist/docs/` before touching a Next feature.

- `proxy.ts`, not deprecated `middleware.ts`
- `cookies()` and route `params` are async
- proxy = optimistic check only
- every Server Action and Route Handler authorizes its own request, starting
  from `siteFromRequest`

## Immutable product decisions

- Polish UI, mobile first, photos only.
- Max 10 files per batch, 25 MiB per original.
- Private R2 buckets. Nothing is served from a bucket URL; every read and
  write goes through a handler that checks a cookie and the site.
- Every D1 query filters on `site_id`. One site's cookies are keyed by its
  own `session_key_version`.
- One deployment, one archive backend, behind the `ArchiveBackend` contract
  and the signed-receipt boundary. Archive tokens name the site and the
  origin; keys live under `sites/<siteId>/originals/`.
- `hot_status`, `archive_status`, `moderation_status` independent.
- Gallery = `hot_status=uploaded` AND `moderation_status=approved`.
- No Realtime. The gallery keeps itself semi-fresh with a ten-second poll.
- Guest and admin entry = bearer QR or passphrase, not user accounts. Owner
  entry = magic link, console only.
- **No secret, OAuth output, generated QR, or real photo may enter Git.**

## Visual invariants

Tokens live in `app/globals.css`. Never repeat palette hex in components.
The world is a tokonoma alcove: the interface is achromatic (R=G=B) — ink on
plaster, anchored by a bronze suiban base plane — and the guests' photographs
are the only colour on screen. Muted oxblood and bottle carry error and
success; nothing else is ever tinted. Nothing is rounded — the corner language
is the scoop, a corner cut into the plane rather than bulging out of it, and
`border-radius` is only ever declared inside `@supports (corner-shape: scoop)`
so a browser without it keeps the square edge. Hairline rules and charged
emptiness instead of filled containers. Display
type is Instrument Serif, self-hosted under `public/fonts` so a clean checkout
builds offline. No automatic dark mode; `/pokaz` runs the same world inverted.
A site's theme (`lib/theme.ts`) only re-tunes tokens; it never adds colour to
the interface. Every interactive state keeps WCAG AA contrast and a visible
focus ring.

## Boundaries

| Path | Owns |
| --- | --- |
| `app/` | pages, HTTP handlers |
| `components/` | interactive UI |
| `lib/auth` | session parsing, authorization |
| `lib/cloudflare.ts` | the only touch of Cloudflare bindings and runtime env |
| `lib/db.ts` | D1 access: plain SQL, positional params |
| `lib/sites.ts` | Host -> site, site origin, plan gates |
| `lib/theme.ts` | per-site theme JSON -> CSS |
| `lib/billing/` | Stripe |
| `lib/domain.ts` | cross-boundary limits, status vocabulary |
| `lib/slideshow-protocol.ts` | live wire contract, imported by the worker too |
| `workers/archive` | archive credentials, archive API calls |
| `db/migrations` | only source of truth for the D1 schema |
| `alchemy.run.ts` | infrastructure: Workers, D1, R2, Durable Objects, secrets |

Plans may refine internals. Never silently change a locked contract — the
locked ones are in `docs/data-contracts.md` and the immutable decisions above.

## Required quality gate

`npm run check` before handing off. Focused tests for every authorization or
state-transition change. Clean checkout builds with no network access to font
providers. Do not edit generated Next declarations.

## Working-tree safety

`.agents` predates this app. Leave it alone unless asked. Do not discard
unrelated working-tree changes.
