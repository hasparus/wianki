# Integration Setup

## Supabase

Create the project in a nearby EU region. Link the repository, run migrations,
confirm RLS is enabled on all three tables, and confirm the `gallery` bucket is
private with a 500 KiB limit. The secret key belongs only in Vercel. Upgrade to
Pro for the event period to avoid inactivity and egress risk.

## Google Cloud

Enable billing, Drive API, and Vision API. Create a service account used only by
Vision and grant the minimum Vision invocation permission. Create a separate
desktop OAuth client for personal Drive. Publish the consent app before relying
on its refresh token.

The bootstrap script opens a loopback callback on port 53682, requests only
`drive.file`, creates `Wesele – oryginały`, and writes ignored OAuth output.

## Cloudflare

Copy `.dev.vars.example` to `.dev.vars` for local testing. Production credentials
must be installed with `wrangler secret put`; do not place them in
`wrangler.jsonc`. Set `ALLOWED_ORIGIN` to the exact production origin. Deploy
from `workers/drive-archive`.

## Vercel and DNS

Import the private GitHub repository, configure every `.env.example` value in
the correct environment, and attach `wedding.pawel.space`. Use Vercel's requested
DNS record; this does not alter the root portfolio site. Preview deployments
should use separate entry tokens and must not point at the production Worker.
