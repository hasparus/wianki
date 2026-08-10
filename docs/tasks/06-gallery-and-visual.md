# Planner brief: gallery and visual experience

## Objective

Deliver an accessible Polish mobile gallery consistent with the wedding palette.

## Fixed decisions

Approved-only; newest first; cursor pages of 25; one-hour signed URLs; manual
refresh; approximate distinct-browser guest count; no polling/Realtime; exact
visual tokens and no dark mode.

## Owned surfaces

Gallery query/API, counters, responsive grid, lightbox, upload presentation,
loading/empty/error states, and accessibility.

## Dependencies and outputs

Consumes task 01 data eligibility and task 02 guest access. Produces the guest
experience and signed-read behavior.

## Non-goals

No comments, likes, accounts, captions, face tags, downloads of originals, or
automatic background refresh.

## Risks

Egress, loading all photos, expired URLs, inaccessible masonry/lightbox,
rose-on-ivory text, and motion sensitivity.

## Acceptance

Only eligible rows; cursor has no duplicates in expected event volume; 44px
targets; visible focus; Escape closes dialog; reduced motion honored; contrast
checks cover every semantic state.
