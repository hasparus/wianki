# Wedding Gallery Agent Guide

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
