# Screenshots — black and white tokonoma redesign

Assets branch. It carries no application code and is never meant to be merged;
it exists so the pull request for `claude/ecstatic-archimedes-ikdp6n` can embed
images without putting binaries into the code history.

Captured from a production build (`next build && next start`) driven by
Playwright against the preinstalled Chromium, at 1440x900 @2x and iPhone 15 @2x.

**The photographs are synthetic.** No real wedding photo is in this repository
or in these captures. Each plate was generated procedurally — two soft light
sources over a dark ground plus grain — so the shots can show the rule that
guests' photographs are the only colour on screen. The rows and signed URLs
behind the captures came from a throwaway local Supabase stub; the admin
statuses and the slide deck are fixtures, not production data. The `/pokaz`
shots were taken with `GUEST_JOIN_CODE` unset, so no generated QR code appears.

| File | Surface |
| --- | --- |
| `desktop-gallery-fold.png` / `mobile-gallery-fold.png` | `/` first viewport |
| `desktop-gallery.png` / `mobile-gallery.png` | `/` full page |
| `desktop-placement.png` / `mobile-placement.png` | the lightbox — the signature interaction |
| `desktop-login.png` / `mobile-login.png` | `/login` |
| `desktop-privacy.png` / `mobile-privacy.png` | `/privacy` |
| `desktop-pokaz.png` / `mobile-pokaz.png` | `/pokaz`, the night side |
| `desktop-admin.png` / `mobile-admin.png` | `/admin` moderation queue |
| `desktop-admin-pokaz.png` / `mobile-admin-pokaz.png` | `/admin/pokaz` slide editor |
| `desktop-admin-viewport.png` | `/admin` first viewport |
| `corner-detail.png` | the cut corner, close up: a field and an ink block at 3x |
