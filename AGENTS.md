# Wedding gallery agent guide

## Project in one minute

Private Polish-first wedding photo gallery. Guest enters by shared QR token or
invitation passphrase -> signed guest cookie -> privacy notice -> uploads from
phone. No named accounts. Never tie an upload to name, email, or IP.

Per photo: browser builds EXIF-free derivative -> private Supabase `gallery`
bucket. Original streams through `workers/archive` -> R2 (`ARCHIVE_BACKEND=r2`,
default) or the couple's Drive folder (`=drive`). Finalize verifies both, then
Vision SafeSearch checks the derivative. `MODERATION_ENABLED=false` ->
auto-approve, skip Vision.

Gallery shows uploaded + approved derivatives only, newest first, refreshed by
hand. That rule never changes.

Admin enters by separate private QR token, 12-hour signed cookie. `/admin` =
moderation and recovery queues: approve, hide, retry moderation, reconcile
archive, confirm deletion. Deletion can half-fail, so Supabase deletion and
archive removal stay retryable.

Canonical production site: `https://wedding.pawel.space`. Do not add or restore
other production domains unless asked. The `wianki.vercel.app` in the wrangler
configs is a fork deploy, not a second canonical domain.

V1 excludes video, comments, likes, face recognition, named accounts, Realtime,
background polling. One addition on top: live slideshow (`/pokaz`, editor
`/admin/pokaz`, worker `workers/slideshow-live` on PartyServer Durable
Objects). Anonymous ephemeral reactions and comments, never persisted. Gallery
still has no comments or likes. See `docs/slideshow.md`.

External services, none preconfigured: Supabase (DB, derivatives), Cloudflare
Workers (streaming boundary), R2 or Drive (originals), Vision (moderation),
Vercel (hosting). Follow `README.md`, `docs/integrations.md`,
`docs/operations.md`.

Start here, then read only the source and the one doc your task needs.
`docs/architecture.md` = request flow. `docs/data-contracts.md` = persisted
states.

## Next.js 16 rule

Not the Next.js in your training data. Read the matching guide in
`node_modules/next/dist/docs/` before touching a Next feature.

- `proxy.ts`, not deprecated `middleware.ts`
- `cookies()` and route `params` are async
- proxy = optimistic check only
- every Server Action and Route Handler authorizes its own request

## Immutable product decisions

- Polish UI, mobile first, photos only.
- Max 10 files per batch, 25 MiB per original.
- Private Supabase bucket. No public table or object policies.
- One deployment, one archive, behind the `ArchiveBackend` contract and the
  signed-receipt boundary.
- `hot_status`, `archive_status`, `moderation_status` independent.
- Gallery = `hot_status=uploaded` AND `moderation_status=approved`.
- No Realtime, no background polling.
- Admin entry = bearer QR, not user accounts.
- **No secret, OAuth output, generated QR, or real photo may enter Git.**

## Visual invariants

Tokens live in `app/globals.css`. Never repeat palette hex in components.
Forest green on ivory = normal text. Rose = decorative, never body text on
ivory. No automatic dark mode. Every interactive state keeps WCAG AA contrast
and a visible focus ring.

## Boundaries

| Path | Owns |
| --- | --- |
| `app/` | pages, HTTP handlers |
| `components/` | interactive UI |
| `lib/auth` | session parsing, authorization |
| `lib/supabase` | client construction |
| `lib/domain.ts` | cross-boundary limits, status vocabulary |
| `lib/slideshow-protocol.ts` | live wire contract, imported by the worker too |
| `workers/archive` | archive credentials, archive API calls |
| `supabase/migrations` | only source of truth for production schema |

Plans may refine internals. Never silently change a locked contract — the
locked ones are in `docs/data-contracts.md` and the immutable decisions above.

## Required quality gate

`npm run check` before handing off. Focused tests for every authorization or
state-transition change. Clean checkout builds with no network access to font
providers. Do not edit generated Next declarations.

## Working-tree safety

`.agents` predates this app. Leave it alone unless asked. Do not discard
unrelated working-tree changes.
