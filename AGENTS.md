# Wedding Gallery Agent Guide

## Project in one minute

This repository is a private, Polish-first wedding photo gallery. Guests enter
through a shared QR token or manual invitation passphrase, receive a signed
guest cookie, accept the privacy notice, and upload photos from their phones.
There are no named guest accounts and uploads must not be associated with names,
email addresses, or IP addresses.

For each photo, the browser creates an EXIF-free gallery derivative and uploads
it directly to the private Supabase `gallery` bucket. The original streams
through `workers/drive-archive` into the couple's private Google Drive folder.
Finalization verifies both destinations, then Google Vision SafeSearch checks
the derivative. Only successfully uploaded, moderation-approved derivatives
appear in the manually refreshed, newest-first gallery.

Administrators enter through a separate private QR token and 12-hour signed
cookie. `/admin` exposes moderation and recovery queues plus approve, hide,
moderation retry, Drive reconciliation, and confirmed deletion actions.
Deletion can partially fail, so Supabase deletion and Drive trashing remain
retryable.

The sole canonical production site is `https://wedding.pawel.space`. Do not add
or restore alternative production domains without an explicit user request.

V1 intentionally excludes videos, comments, likes, facial recognition, named
accounts, Realtime subscriptions, and background polling. External services are
Supabase (database and private derivatives), a Cloudflare Worker (streaming
boundary), Google Drive (private originals), Google Vision (moderation), and
Vercel (Next.js hosting). Do not assume those services are already configured;
follow `README.md`, `docs/integrations.md`, and `docs/operations.md`.

Use this summary as the baseline for a new task, then inspect only the relevant
source files and focused document under `docs/`. `docs/architecture.md` explains
the full request flow, `docs/data-contracts.md` defines persisted states, and
`docs/tasks/` contains delegatable workstream briefs.

## Next.js 16 rule

This is not the Next.js remembered from older training data. Before changing a
Next.js feature, read the matching guide in `node_modules/next/dist/docs/`.
In particular:

- use `proxy.ts`, not deprecated `middleware.ts`;
- `cookies()` and route `params` are asynchronous;
- Proxy is only an optimistic access check;
- every Server Action and Route Handler authorizes its own request.

## Immutable product decisions

- Polish UI, mobile first, photos only.
- Maximum 10 files per batch and 25 MiB per original.
- Private Supabase bucket; no public table or object policies.
- Originals stream through the Cloudflare Worker into a user-owned Drive folder.
- `hot_status`, `archive_status`, and `moderation_status` are independent.
- Gallery contains only `hot_status=uploaded` and `moderation_status=approved`.
- No Realtime or background polling in v1.
- Admin entry is a private bearer QR, not a user-account system.
- No secret, OAuth output, generated QR code, or real photo may enter Git.

## Visual invariants

Use the tokens defined in `app/globals.css`; never duplicate palette hex values
inside components. Forest green on ivory is the normal text pairing. Rose is
decorative and must not be ordinary text on ivory. Do not add automatic dark
mode. All interactive states must retain WCAG AA contrast and visible focus.

## Boundaries

- `app/` owns pages and HTTP handlers.
- `components/` owns interactive UI only.
- `lib/auth` owns all session parsing and authorization.
- `lib/supabase` owns Supabase client construction.
- `lib/domain.ts` owns cross-boundary limits and status vocabulary.
- `workers/drive-archive` owns Google Drive credentials and Drive API calls.
- `supabase/migrations` is the only source of truth for production schema.
- Planner briefs live in `docs/tasks`; implementation plans may refine internals
  but must not silently change locked contracts.

## Required quality gate

Run `npm run check` before handing off. Add focused tests for every authorization
or state-transition change. A clean checkout must build without network access
to font providers. Do not modify generated Next.js declarations.

## Working-tree safety

The `.agents` directory predates this application setup and is not part of the
wedding implementation. Preserve it unless the user explicitly asks otherwise.
Do not discard unrelated working-tree changes.
