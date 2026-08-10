# Integration setup

## Supabase

Project in a nearby EU region. Link repo, run migrations. Check RLS on for all
three tables, `gallery` bucket private, 500 KiB limit. Secret key in Vercel
only. Pro for the event month, so inactivity and egress don't bite.

## Google Cloud

Billing on, Vision API on. Service account for Vision only, minimum invocation
permission. Skip this whole section when `MODERATION_ENABLED=false` and
`ARCHIVE_BACKEND=r2`.

Drive backend only: Drive API plus a separate desktop OAuth client. Publish the
consent app before relying on the refresh token — a Testing one dies after 7
days. `npm run drive:bootstrap` opens a loopback callback on port 53682, asks
for `drive.file` only, creates `Wesele – oryginały`, writes git-ignored output.

## Cloudflare

`.dev.vars.example` -> `.dev.vars` for local runs. Production credentials go in
with `wrangler secret put`, never into `wrangler.jsonc`. `ALLOWED_ORIGIN` = the
exact origin the app is served from. Deploy `workers/archive` and
`workers/slideshow-live`.

`ARCHIVE_BACKEND` picks the archive. Plain var, not a secret, so the deployed
choice shows up in config review. `r2` needs the `ARCHIVE_BUCKET` binding and
refuses to start without it. `drive` needs the four `GOOGLE_*` secrets, no
bucket. Same value in Vercel, or the admin deletion warning describes the wrong
thing.

## Vercel and DNS

Import the private repo, set every `.env.example` value in the right
environment, attach `wedding.pawel.space` with the DNS record Vercel asks for.
Does not touch the root portfolio site. Previews use separate entry tokens and
never point at the production Worker.
