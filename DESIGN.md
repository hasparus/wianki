---
name: Rosia & Piotrek — Wedding Gallery
description: An achromatic tokonoma alcove where the guests' photographs are the only colour in the room.
colors:
  plaster: "#efefef"
  plaster-lit: "#f7f7f7"
  paper: "#ffffff"
  ash: "#d8d8d8"
  ash-deep: "#b4b4b4"
  pine: "#666666"
  disabled: "#767676"
  bronze: "#2a2a2a"
  ink: "#1a1a1a"
  ink-deep: "#0a0a0a"
  oxblood: "#8c2318"
  bottle: "#1e4d2b"
typography:
  display:
    fontFamily: "var(--font-instrument-serif), Iowan Old Style, Georgia, serif"
    fontSize: "clamp(3.25rem, 13vw, 7.5rem)"
    fontWeight: 400
    lineHeight: 0.92
    letterSpacing: "-0.02em"
  headline:
    fontFamily: "var(--font-instrument-serif), Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2.25rem, 6vw, 3.75rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "normal"
  title:
    fontFamily: "var(--font-instrument-serif), Iowan Old Style, Georgia, serif"
    fontSize: "clamp(2rem, 5vw, 3.25rem)"
    fontWeight: 400
    lineHeight: 0.95
    letterSpacing: "normal"
  numeral:
    fontFamily: "var(--font-instrument-serif), Iowan Old Style, Georgia, serif"
    fontSize: "3rem"
    fontWeight: 400
    lineHeight: 1
    fontFeature: "tnum 1"
  body:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "1rem"
    fontWeight: 400
    lineHeight: 1.65
    letterSpacing: "normal"
  label:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.6875rem"
    fontWeight: 400
    lineHeight: 1.4
    letterSpacing: "0.24em"
  action:
    fontFamily: "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif"
    fontSize: "0.8125rem"
    fontWeight: 500
    lineHeight: 1
    letterSpacing: "0.16em"
rounded:
  none: "0"
  scoop: "0.5rem"
  scoop-plane: "0.875rem"
spacing:
  hairline: "1px"
  rule: "2rem"
  gutter-sm: "1.25rem"
  gutter-md: "2.5rem"
  gutter-lg: "4rem"
  plane-pad-sm: "1.25rem"
  plane-pad-md: "2rem"
  plane-pad-lg: "2.5rem"
  control-height: "3rem"
  control-height-quiet: "2.75rem"
  base-height: "0.75rem"
  measure: "65ch"
  container: "72rem"
components:
  action:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plaster-lit}"
    typography: "{typography.action}"
    rounded: "{rounded.scoop}"
    padding: "0 1.75rem"
    height: "{spacing.control-height}"
  action-hover:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.plaster-lit}"
  action-disabled:
    backgroundColor: "transparent"
    textColor: "{colors.disabled}"
  action-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    typography: "{typography.action}"
    rounded: "{rounded.scoop}"
    padding: "0 1.75rem"
    height: "{spacing.control-height}"
  action-ghost-hover:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.plaster-lit}"
  action-quiet:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "0 1rem"
    height: "{spacing.control-height-quiet}"
  action-danger:
    backgroundColor: "transparent"
    textColor: "{colors.oxblood}"
  action-danger-hover:
    backgroundColor: "{colors.oxblood}"
    textColor: "{colors.plaster-lit}"
  field:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
    typography: "{typography.body}"
    rounded: "{rounded.scoop}"
    padding: "0 1rem"
    height: "{spacing.control-height}"
    width: "100%"
  plane:
    backgroundColor: "{colors.plaster-lit}"
    textColor: "{colors.ink}"
    rounded: "{rounded.scoop-plane}"
    padding: "{spacing.plane-pad-md}"
  plane-paper:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
  suiban:
    backgroundColor: "{colors.bronze}"
    textColor: "{colors.plaster}"
    rounded: "{rounded.none}"
  stage:
    backgroundColor: "{colors.ink-deep}"
    textColor: "{colors.plaster}"
  stage-action:
    backgroundColor: "{colors.plaster}"
    textColor: "{colors.ink-deep}"
    typography: "{typography.action}"
    rounded: "{rounded.scoop}"
    padding: "0 1.25rem"
    height: "{spacing.control-height}"
  label:
    textColor: "{colors.pine}"
    typography: "{typography.label}"
---

# Design System: Rosia & Piotrek — Wedding Gallery

## Overview

**Creative North Star: "The Tokonoma"**

This is an alcove, not a page. The wall is plaster, the base plane is a dark bronze *suiban*, and every screen is an arrangement of three lines — a primary line (the wordmark), a supporting line (the thanks and the struck counts), and a secondary line (the well you act in) — with the emptiness between them left charged and deliberately empty. The system's entire job is to hold a guest's photograph and get out of its way, so the interface removed its own colour: every interface token is achromatic (R = G = B), and the photographs guests upload are the only live colour on screen.

The world's one accent was translated rather than dropped. Where the alcove used iris blue, this interface reverses the ink: a committed action is a filled ink block with plaster type, and at rest that same control is only a hairline outline. Depth is made of two materials and nothing else — a 1px ash rule, and the dark bronze ground that anchors every light field. No corner is rounded: where the browser supports it, a corner is a scoop cut into the plane, and everywhere else it stays square. Nothing casts a decorative shadow. The one authored motion moment is **placement**: choosing a photograph recedes the arrangement and sets that photograph over the bronze plane, 420ms, once.

The night side (`/pokaz`, the projected slideshow) is the same world with its planes inverted — ink ground, plaster type, photograph still the only colour in the room. It is not a second theme and must never be styled as one.

**Key Characteristics:**
- Achromatic interface; exactly three tinted inks, reserved for error, success, and warning
- The cut corner: a concave scoop (0.5rem on controls, 0.875rem on planes) that degrades to the square edge, never to a round one
- Hairline 1px rules and a dark bronze base instead of shadows
- Instrument Serif set large with tight negative leading, upright only
- Asymmetric three-line arrangements with composed, load-bearing voids
- One authored motion moment (placement), instantly cut under reduced motion

## Colors

An achromatic room with three tinted inks held in reserve; the guests' photographs supply all remaining colour.

### Primary
- **Ink** (`#1a1a1a`): The text colour of the whole light world, the hairline that ranks a heading, the focus outline, and — filled — the committed action block. This is the translated accent: ink is loud only when it becomes a field.
- **Ink Deep** (`#0a0a0a`): The pressed state of a filled action, the scrim behind a placed photograph (at 92%), and the ground of the night side (`/pokaz`).
- **Bronze** (`#2a2a2a`): The *suiban*. The dark base plane that anchors a light field — the footer, the plane a placed photograph is seated on, and the 0.75rem base bar that closes every page.

### Neutral
- **Plaster** (`#efefef`): The alcove wall. The page ground everywhere, carrying the plaster tile texture.
- **Plaster Lit** (`#f7f7f7`): A plane lifted off the wall — the upload well and other raised surfaces. Also the type colour reversed out of ink and the type colour on the bronze and night grounds.
- **Paper** (`#ffffff`): The inside of an input field and the paper variant of a lifted plane. The brightest surface, used only where something is written.
- **Ash** (`#d8d8d8`): The hairline of a lifted plane, of an empty state, of a list divider, and the placeholder block behind a loading thumbnail.
- **Ash Deep** (`#b4b4b4`): The stronger hairline — an input's resting stroke, the underline decoration on quiet links, labels on dark grounds, and the scrollbar thumb.
- **Pine** (`#666666`): Secondary prose, supporting labels, placeholders, and the ampersand inside the wordmark. The only grey allowed to carry running text on plaster.
- **Disabled** (`#767676`): The type colour of a disabled control. A separate token from Pine because it must clear AA against plaster in its own right.

### Tertiary (semantic inks)
- **Oxblood** (`#8c2318`): Error only — an alert line, a per-row failure note, and the destructive action.
- **Bottle** (`#1e4d2b`): Success only.

### Named Rules
**The Achromatic Room Rule.** Every interface colour satisfies R = G = B. Exactly two tinted values exist in the system — oxblood for error and bottle for success — and `test/contrast.test.ts` fails the build the moment a third hex with unequal channels appears in `app/globals.css`. Warning is not a colour here: it is full ink against the pine of an ordinary label, plus copy that says what will happen. A new accent is not a design decision here; it is a broken build.

**The Only Colour Rule.** The guests' photographs are the only other colour on screen. Never tint a surface, an icon, a chart, or a state chip to compete with them.

**The Reversed Ink Rule.** The active accent is a filled ink block with plaster type. Exactly one filled block is live at a time in a given well; every other control in that well is the hairline outline at rest. Two filled blocks side by side means one of them is wrong.

## Typography

**Display Font:** Instrument Serif, self-hosted from `public/fonts` via `next/font/local` and exposed as `--font-serif` (falls back to Iowan Old Style, Georgia, serif). Latin and latin-ext subsets both ship so Polish diacritics never fall back.
**Body Font:** The platform sans stack (`ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial`), exposed as `--font-sans`.

**Character:** One voice speaks and one voice explains. Instrument Serif appears large, upright, and tightly led — a name cut into the wall. Everything that is merely functional recedes into a quiet system sans at a generous 1.65 line-height, so the serif never has to share the stage.

### Hierarchy
- **Display** (400, `clamp(3.25rem, 13vw, 7.5rem)`, 0.92, -0.02em): The wordmark and the page-owning title. One per page, flush left at the left margin, high in the frame, with a 2rem ink rule beneath it.
- **Headline** (400, `clamp(2.25rem, 6vw, 3.75rem)`, 0.95): The section that owns the rest of the page — the gallery heading.
- **Title** (400, `clamp(2rem, 5vw, 3.25rem)` down to a flat 1.5–1.875rem in tight wells): A well's own heading (upload panel, photo challenge, empty-state invitation, admin row title).
- **Numeral** (400, serif, tabular figures, line-height 1, typically 3rem–3.75rem): Struck facts. Live counts of photos and guests are set as real serif numerals, registered rather than decorated.
- **Body** (400, 1rem, 1.65): All running prose. Long-form reading is capped at a 65ch measure; short supporting prose is capped nearer 28rem.
- **Label** (400, 0.6875rem, 0.24em, uppercase, pine): The supporting line — the marginal annotation. It labels a value, a field, or a status. On bronze and night grounds it shifts to ash-deep.
- **Action** (500, 0.8125rem, 0.16em, uppercase): Control type only.

### Named Rules
**The Never An Eyebrow Rule.** The label style is a marginal annotation, never a kicker above a heading. It names a value, a field, or a status. A small tracked caps line sitting directly above a display heading is a violation of this system, not an instance of it.

**The Upright Rule.** Instrument Serif ships upright only. There is no italic in this world; emphasis is size, position, or the rule beneath.

**The Struck Fact Rule.** Numbers that are facts — counts, totals, positions — are set in the serif with tabular figures, never in the body sans.

## Layout

Everything is an asymmetric three-line arrangement on a 12-column grid that only appears at `sm` and above; below that the lines simply stack and the composition reads top to bottom. Content lives in a centred container capped at 72rem (`max-w-6xl`), with page gutters that step 1.25rem → 2.5rem → 4rem (mobile → `sm` → `lg`).

**The One Left Edge Rule.** Every surface carries its gutters on an outer full-width wrapper (`px-5 sm:px-10 lg:px-16`) around an inner `mx-auto w-full max-w-6xl` box — never on the measure box itself. Padding inside the box shifts that surface's left edge inward and puts it on a different edge from every other surface; at 1440 the two patterns differ by 40px. A surface that wants a narrower measure holds it on a child inside the shared box, not by capping the box. Gallery, entry, privacy, admin and the slide editor all start at the same x.

The first viewport is the room, not the grid. Vertical rhythm at the top of a page is set in viewport units (`pt-[5vh]` rising to `pt-[11vh]` at `sm`; `pt-[22vh]`/`pt-[26vh]` on the entry screen, which is `justify-end` so the void sits above the arrangement and the alcove rises from its base) so the arrangement breathes on tall phones and the feed starts below the fold. The lines are offset from one another by column start, not by centring: the supporting line and the struck counts share one band at `sm:col-span-2` and `sm:col-start-3`, and the upload well is pushed to `sm:col-start-5`. The void reopens to the right of the supporting line and stays empty.

The photograph feed is a full-viewport-width, fixed-height horizontal rail, not a page-length grid. Guests swipe sideways through it; a mouse wheel follows the same axis while the rail can still move. Pinching or using the plain minus/plus icons changes whether one, two, or three rows share the rail without changing its outer height. A pinch crosses a deliberate threshold, then Motion layout springs carry each plate into the next row level; never scale and reset the whole rail. One row preserves each photograph's proportion; denser views use evenly sized cropped plates that expand to fill an otherwise short rail. The photograph at the gesture's focal point stays anchored when density changes. Lists — upload queue, admin queue, challenge tasks — are hairline-divided rows, never cards.

Interactive targets never go below 2.75rem of height, and the projected surface holds 3rem. Anything sitting at the bottom edge pads with `max(1rem, env(safe-area-inset-bottom))`.

**The Anchored Base Rule.** Every page closes on the bronze plane — either a full `suiban` footer or the 0.75rem base bar. A light field that ends without a dark plane beneath it is floating, and floating is wrong.

## Elevation & Depth

There are no shadows in this system. Nothing in the light world casts one; depth is made of exactly two things — a hairline stroke, and the dark ground. A plane lifts off the wall by being one step lighter than plaster (`#f7f7f7` on `#efefef`) inside a 1px ash rule; that is the entire elevation vocabulary. Material, not lighting, does the rest: the plaster wall and bronze base are authored tiles (`public/textures/plaster.png`, `public/textures/bronze.png`), deterministic seeded value-noise generated by `scripts/make-textures.mjs` at 512px and laid down at a 256px tile, carrying their own tone rather than being screened over a flat field.

One cast shadow exists and it is not decoration. On the night side, controls sit directly on a guest's photograph with no pill or scrim behind them, and a two-stop `drop-shadow` stack holds them legible against an unpredictable image. It is a legibility device confined to `/pokaz`; it is never a resting elevation.

### Shadow Vocabulary
- **Stage control legibility** (`filter: drop-shadow(0 1px 3px rgb(0 0 0 / 90%)) drop-shadow(0 2px 12px rgb(0 0 0 / 55%))`): Only for chrome overlaid on a photograph on the night side. Never on the plaster world.

### Named Rules
**The Hairline Depth Rule.** Depth is the rule and the ground, never a shadow. If a surface needs to feel raised, give it the lit plane and a 1px ash stroke; if it needs to feel anchored, put bronze underneath it.

**The Structural Rule Rule.** The 2rem ink rule ranks a heading. It is structure, not ornament — never a decorative divider between sections, and never centred. The full-width ash rule is the only rule allowed to separate.

## Shapes

Cut, never rounded. The corner language is the **scoop**: `corner-shape: scoop` at `--ma-scoop` (0.5rem) on controls and fields, `--ma-scoop-plane` (0.875rem) on lifted planes and empty states, and `--ma-scoop-tight` (0.25rem) on icon-only controls, where the full scoop would eat a 44px square. The corner bites into the plane the way the alcove's edges are carved out of it, rather than bulging away from it.

`corner-shape` needs a radius to bite into, so `border-radius` is declared **only** inside `@supports (corner-shape: scoop)` — it exists nowhere else in the system. A browser without the property never sees a radius and keeps the square edge; the fallback is the plain corner, never a rounded one, and `test/corner-shape.test.ts` fails the build if a radius escapes that query. Photographs, thumbnails and the placed plate take no corner treatment at all: the guests' images are not cut into. The closest rail view preserves each photograph's proportion; the two denser rail views crop into evenly sized plates to keep their rows stable and fill the viewport when only a few photographs exist.

The recurring silhouette is the hairline box drawn in one stroke — a 1px rectangle around a field, a plane, an empty state, or a queue row — and its inverse, the filled ink block. A control moves between those two states and nothing in between. Horizontal geometry is set by two rule lengths: the 2rem short rule that ranks a heading, and the full-width ash rule that separates. Photographs are never cropped to a circle or a fixed ratio in the feed; only the small confirmation thumbnails take a square aspect, and the queue thumbnail a 3.5rem square.

Icons are line-drawn SVG at the ambient stroke weight; the app icon itself is two overlapping ink circles on plaster, stroked at 3 and never filled.

## Components

### Buttons
- **Shape:** 1px stroke with a 0.5rem scooped corner (square where `corner-shape` is unsupported), 3rem tall (2.75rem for the quiet variant), 1.75rem of horizontal padding, uppercase 0.8125rem/500 at 0.16em tracking.
- **Primary (`ma-action`):** The reversed ink block — ink fill, plaster-lit type, ink stroke. Hover deepens to ink-deep. Only one is live in a well.
- **Ghost (`ma-action--ghost`):** The same box unfilled — transparent fill, ink type, ink stroke. Hover inverts it into the filled block, which is how the rest state and the committed state stay visibly the same object.
- **Quiet (`ma-action--quiet`):** No stroke and no fill at rest; hover draws the ink stroke only. For repeated in-row affordances where a box would shout.
- **Danger (`ma-action--danger`):** Destruction is available, never loud. At rest it is not a box at all — an oxblood word underlined at 40% opacity with a 0.35em offset. Hover *and* focus-visible fill it oxblood with plaster-lit type and drop the underline.
- **Disabled:** Fill drops to transparent, stroke to ash, type to the disabled grey, cursor `not-allowed`.
- **Transitions:** background and colour at 160ms on the world easing. Nothing moves, scales, or lifts.

### Inputs / Fields
- **Style (`ma-field`):** A box drawn in one stroke — 1px ash-deep on paper white, 3rem tall, full width, 1rem inline padding, body type at 1rem, with the 0.5rem scooped corner (square where `corner-shape` is unsupported).
- **Hover:** stroke darkens to pine. **Focus:** stroke goes ink *and* a 1px ink outline is drawn at 2px offset — a doubled hairline, not a glow.
- **Disabled:** ash stroke, disabled grey type. **Error:** the field keeps its stroke; the message appears beneath it as oxblood body copy at 500.
- Placeholders are pine at full opacity; the caret is ink (plaster on the night side).

### Cards / Containers
- **Plane (`ma-plane`):** There are no cards, only planes. Lit plaster inside a 1px ash stroke, a 0.875rem scooped corner (square where `corner-shape` is unsupported), no shadow, internal padding stepping 1.25rem → 2rem → 2.5rem. `ma-plane--paper` swaps the fill to paper white.
- **Empty state (`ma-empty`):** A composed invitation, not a collapsed line. It keeps the full field of the thing it is waiting for — a 1px ash box scooped at the plane depth (0.875rem), with `clamp(2.5rem, 9vw, 5rem)` of vertical padding, its content left-aligned inside a centred grid, holding a serif title, a 2rem rule, and one line of pine prose.
- **Lists:** hairline-divided rows (`divide-ash` inside a top-and-bottom ash border), never boxed per item.

### Navigation
There is no nav bar. Wayfinding is the wordmark, ghost actions placed in the section that owns them, and a footer on the bronze plane whose links are label-styled, underlined in ash-deep, brightening to plaster on hover. Nothing names the room it sits in: a marginal word riding the right edge was built and removed, because the wordmark and the heading already said where you were.

### Placement (signature)
Choosing a photograph does not open a modal chrome. The arrangement recedes behind an ink-deep scrim at 92% (fading in over 220ms), and the chosen photograph is *placed*: 420ms on `cubic-bezier(0.16, 1, 0.3, 1)`, from `scale(0.94) translateY(1.25rem) blur(6px)` to rest, off-axis toward the right on wide frames. The plate is *seated* on the bronze plane rather than floating above it: the plane is a readable `18vh` (floor `min-h-28`) carrying the one control at its lower right, separated by a pine hairline, and the photograph's bottom edge meets its top edge. A base that reads as a strip leaves a pinched sliver of the receded arrangement under the plate, which is the arrangement failing to meet its base. Escape returns it to its place. Under `prefers-reduced-motion`, the animation name is removed outright so the photograph is simply already there.

### Night side (`/pokaz`)
The same world with the planes inverted: ink-deep ground, plaster type, ash-deep labels, plaster focus outlines and selection. Actions reverse too — `ma-stage-action` is a plaster fill with ink-deep type. Fields on the projection are a translucent ink-deep panel behind a 6px backdrop blur inside a 45% plaster hairline; the blur exists because they float over a photograph. Slides enter at 380ms from `blur(12px) scale(1.02)` and leave at 260ms into `blur(8px)`. Ephemeral guest reactions float up and sway; ephemeral comments drift across on plaster chips in serif. None of it persists, and none of it tints the room.

### Named Rules
**The Utilities Win Rule.** Every `ma-*` class is defined inside `@layer components` on purpose, so a Tailwind utility always overrides it. Compose by putting the component class first and adjusting with utilities; never fight it with `!important`.

**The One Authored Moment Rule.** Placement is the only motion this system authors. Everything else is a 160ms colour transition from an already-visible default, and reduced motion cuts placement to an instant. A second animated moment was built once, for the upload confirmation, and removed: two authored moments is none.

## Do's and Don'ts

### Do:
- **Do** keep every new interface colour achromatic (R = G = B) and pull it from the existing ramp; `test/contrast.test.ts` is the audit.
- **Do** reserve oxblood (`#8c2318`) and bottle (`#1e4d2b`) for error and success, and use them as ink — on type or as a fill under plaster-lit type. Every other state, warning included, is achromatic.
- **Do** put exactly one filled ink block in a well; every other control there is the hairline outline.
- **Do** close every page on the bronze plane — a `ma-suiban` footer or the 0.75rem `ma-base` bar.
- **Do** rank a heading with the 2rem ink rule and compose the line beneath it off-axis, using column starts rather than centring.
- **Do** set counts, totals, and positions in the serif with tabular figures.
- **Do** give every interactive element a visible focus treatment that clears AA — the ink (or plaster, on the night side) outline at 3px offset, and the doubled hairline on fields.
- **Do** author new texture as a deterministic seeded tile through `scripts/make-textures.mjs` so a clean checkout can regenerate it.
- **Do** mark an action that leaves the page with the long arrow, pointing the way, and leave it off anything that acts where it stands.

### Don't:
- **Don't** add a rounded corner anywhere. The only radius in the system lives inside `@supports (corner-shape: scoop)`, where it is what the scoop cuts into; a radius outside that query is a round corner, and the build fails on it.
- **Don't** scoop a photograph, a thumbnail or the placed plate. The corner treatment belongs to the interface, and the interface does not cut into a guest's image.
- **Don't** add an element whose only job is to name the screen it sits on. A label that repeats the heading, a heading that repeats the page, a wordmark in the footer of the page it already titles: all of it went, and it goes again.
- **Don't** introduce a shadow for elevation. Use the lit plane plus an ash hairline, or the bronze ground. The only shadow in the system is the night-side legibility drop-shadow on chrome sitting over a photograph.
- **Don't** set a small tracked-caps line above a heading. The label is a marginal annotation for a value, a field, or a status — never a kicker or eyebrow.
- **Don't** centre a display heading or a page's primary line; the arrangement is asymmetric and flush left.
- **Don't** use the 2rem rule as a decorative divider between sections, and don't ornament a section break at all — the full-width ash rule or a dark plane does that work.
- **Don't** set body text in Instrument Serif, and don't introduce an italic; the face ships upright only.
- **Don't** inset the photograph feed with the page content or let it reflow vertically. It spans the viewport as a fixed-height horizontal rail; density changes happen inside that height and keep the gesture's focal photograph anchored.
- **Don't** treat `/pokaz` as a dark theme with its own tokens. It is the same tokens with the planes inverted.
- **Don't** animate anything beyond placement, the night-side slide change, and 160ms colour transitions — and never animate from an invisible default.
- **Don't** load a font over the network; the display face is vendored under `public/fonts` and the body face is the platform stack.
