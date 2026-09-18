---
version: 1
slug: "app-page-tsx"
primary_target: "app/page.tsx"
related_targets: ["app/login/page.tsx","app/privacy/page.tsx","app/admin/page.tsx","app/admin/pokaz/page.tsx","app/pokaz/page.tsx","app/globals.css"]
---

Scope: the whole guest- and couple-facing app — `/login`, `/` (gallery + upload +
photo challenge), the lightbox, `/privacy`, `/admin`, `/admin/pokaz`, `/pokaz`.
Visitor mode: Experience on `/`, `/pokaz` and the lightbox; Operate on `/login`,
upload, `/admin` and `/admin/pokaz`; Read on `/privacy`. One world across all of
them.

Audience and job: a wedding guest on a phone, in a dark reception hall, who wants
to drop the photos they just took and see what everyone else caught. Secondary:
an admin working moderation and recovery queues, and a presenter driving the
evening slideshow.

Constraints that bind: Polish copy, mobile first, photos only, 10 files per
batch, 25 MiB each, no named accounts, no Realtime, hand refresh only.
User-pinned: achromatic interface (R=G=B), muted semantic red and green kept for
error and success only, Instrument Serif as the display face, guests' photographs
in full colour. Clean checkout must build with no network to font providers, so
Instrument Serif ships self-hosted.

Memorable moment: **placement** — choosing a photograph does not open a modal; the
arrangement recedes and the photograph is placed in the alcove over the dark
suiban plane.

Unresolved: none. The direction round resolved scope, colour rule and build path.

## Direction contract

THESIS: Space gives form. This gallery owns the rule that the emptiness around a
photograph is doing work — an asymmetric arrangement of three lines with charged
voids between them, where the guests' photographs are the only live accent in an
otherwise achromatic room. It refuses the wedding-gallery arrangement this app
itself shipped: centred headings, rounded cream cards with a rose accent, an even
grid of equal tiles, a decorative divider between every section.

OWN-WORLD: the tokonoma alcove, translated to a pinned achromatic palette.
Plaster ground `#EFEFEF`, lit plane `#F7F7F7`, paper `#FFFFFF`, earth-ash
`#B4B4B4`, pine `#666666`, bronze suiban `#2A2A2A`, ink `#1A1A1A`; the world's
iris-blue accent is translated, not dropped — the active accent becomes *reversed
ink* (a filled ink field with plaster type) wherever the source used its one live
colour, and muted oxblood `#8C2318` / bottle `#1E4D2B` carry error and success
only. Nothing is rounded: hairline 1px rules, square corners, and the dark
suiban plane as the base that anchors every light field. Instrument Serif,
self-hosted, set large with tight leading for display; a quiet system sans for
body; supporting labels in light letterspaced caps. No shadows as decoration —
depth comes from the ash rule and the bronze base. Component language: outlined
hairline box at rest, reversed ink block when active, a short 2rem rule under a
heading, a marginal vertical tracked word at the right edge on wide frames.

STORY: the guest understands in one glance that this is Rosia and Piotrek's room
and that the photographs in it are other guests'; believes their own photo is
wanted and will not be tied to their name; and drops a batch from the primary
action sitting at thumb height without reading an instruction.

FIRST VIEWPORT: full-height plaster. The wordmark "Rosia & Piotrek" is the
primary line (shin), set in Instrument Serif at clamp(3.5rem, 12vw, 7.5rem),
flush left at the left margin, high in the frame, with a 2rem ink rule beneath
it. The supporting line (hikae) — the thanks, then the live struck counts, photos
and guests as real numerals with letterspaced caps labels — sits lower and
indented, leaving a charged void to its right. The secondary line (soe) is the
upload well: a hairline-boxed field on the lit plane, offset right and lower
still, its reversed-ink primary action at thumb height. Those three lines form the
asymmetric triangle; the void between them is composed and stays empty. A vertical
tracked "GALERIA" rides the right margin on wide frames. The arrangement (the
photograph feed) begins below the fold on a bronze-anchored rule, so the first
viewport is the room, not the grid.

FORM: the tokonoma / ikebana-ma world, dealt as challenger 2 of the direction
roll and chosen by the user over the assigned grounded direction; seed key
a3b3d770 (scope direction, mode experience). Raised before presentation by the
declined hands: total ink commitment across every browser surface (Mondo), the
plate owns the viewport in lightbox and `/pokaz` (shader portal), the empty sheet
is a composed invitation (drum machine), counts and statuses are struck facts
with real numerals (forge), and the hairline rule is structural rather than
decorative (bebop). Signature interaction: **placement** — selecting a photograph
recedes the arrangement (the other frames drop to the plaster ground) and places
the chosen one over the bronze suiban plane, off-axis, its controls on the vessel
strip; Escape returns it to its place. Motion grammar: one authored moment,
420ms exponential ease-out from an already-visible default, and reduced motion
replaces the placement with an instant cut.

FINISH: unreviewed and undocumented is unfinished; this build ends with the
finish review, the verdict, DESIGN.md, and every shipping raster carrying its
provenance.
