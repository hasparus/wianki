# Visual system

The world is a **tokonoma alcove**: a plaster wall, an asymmetric arrangement of
three lines — primary, secondary, supporting — and the emptiness between them
left charged rather than filled. Guests' photographs are the arrangement's one
live accent, and the only colour on screen.

`DESIGN.md` is the generated record of the built system; this page is the short
version a contributor needs before touching a component.

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| ma-plaster | `#EFEFEF` | the alcove wall — page ground |
| ma-plaster-lit | `#F7F7F7` | a plane lifted off the wall |
| ma-paper | `#FFFFFF` | the inset white of a field |
| ma-ash | `#D8D8D8` | hairline rules and dividers |
| ma-ash-deep | `#B4B4B4` | earth ash: field borders, muted marks |
| ma-pine | `#666666` | secondary text |
| ma-disabled | `#767676` | inactive control text |
| ma-bronze | `#2A2A2A` | the suiban: base planes, footer, vessel strip |
| ma-ink | `#1A1A1A` | primary text and reversed-ink fields |
| ma-ink-deep | `#0A0A0A` | pressed state and the night stage |
| ma-oxblood | `#8C2318` | error, and only error |
| ma-bottle | `#1E4D2B` | success, and only success |
| ma-amber | `#6B4A00` | warning |

Every interface token is achromatic (R = G = B). The three semantic inks are the
only tinted values in the system, and `test/contrast.test.ts` fails the build if
a fourth appears in `app/globals.css`.

Contrast: ink on plaster ~15.1:1, pine on plaster ~5.0:1, oxblood on plaster
~7.7:1, bottle ~8.5:1, amber ~7.0:1, ash-deep on bronze ~6.9:1, plaster on the
night ground ~17.2:1.

## Type

Display is **Instrument Serif**, vendored as woff2 under `public/fonts` and
loaded with `next/font/local`, so a clean checkout builds with no network access
to a font provider. Both Latin subsets ship — Polish needs latin-ext. Body and
UI text use a neutral system sans stack. Supporting labels are `.ma-label`:
0.6875rem, 0.24em tracking, uppercase.

## Components

Defined in `app/globals.css` under `@layer components`, so Tailwind utilities
still override them.

- `.ma-rule` — the 2rem rule that ranks a heading. Structural, never a divider.
  It takes the ground it sits on inside `.ma-suiban` and `.ma-stage`.
- `.ma-action` — the active accent, translated from the alcove's iris blue into
  reversed ink: a filled ink block. `--ghost` is the hairline outline at rest,
  `--danger` is oxblood, `--icon` is a single drawn icon at the touch minimum,
  and disabled is always a hairline, never a grey slab.
- The long arrow inside an action means travel: it appears on a `Link` or `a`
  that leaves the page and points the way, never on a `button` that acts where
  it stands. `test/arrow-language.test.ts` fails the build if a button takes
  one.
- `.ma-field` — a text input drawn in one hairline stroke.
- `.ma-empty` — an empty state as a composed invitation: it keeps the full field
  of the thing it is waiting for.
- `.ma-numeral` — struck facts: real tabular numerals in the display face.
- `.ma-suiban` / `.ma-stage` — the dark base plane, and the night side that
  `/pokaz` runs on.

## Corners

Nothing is rounded. The corner language is the **scoop**: a corner cut into the
plane, the way the alcove's edges are carved rather than filled. It is set with
`corner-shape: scoop` at `--ma-scoop` (0.5rem, controls and fields),
`--ma-scoop-plane` (0.875rem, lifted planes and empty states) or
`--ma-scoop-tight` (0.25rem, icon-only controls, where the full scoop would eat
a 44px square). Every rule that declares a radius repeats the scoop beside it,
so the pairing is visible in one line rather than inherited from a selector
further up.

`corner-shape` needs a radius to bite into, so the radius is declared **only**
inside `@supports (corner-shape: scoop)`. A browser without the property never
sees a `border-radius` and keeps the square edge — the fallback is the plain
corner, never a rounded one. `test/corner-shape.test.ts` fails the build if a
radius escapes that query.

Depth comes from the hairline and the dark ground, never from a shadow.

## Motion

One authored moment: **placement**. Choosing a photograph recedes the
arrangement and places that photograph over the suiban plane — `ma-place`,
420ms, `cubic-bezier(0.16, 1, 0.3, 1)`, from an already-visible default.
Reduced motion replaces it with an instant cut.

## Interaction

Touch targets >= 44px. Every icon-only control has an accessible name, drawn
from `components/slideshow/icons.tsx` (24px grid, 2px round stroke) — never an
emoji. Reaction emoji on the slideshow are content, not icons. Dialogs close by
button, backdrop, or Escape. Gallery images use empty alt — no meaningful
caption exists; the surrounding button names the action. Browser surfaces
(selection, caret, scrollbar, focus ring, underline offset) are themed from the
palette.
