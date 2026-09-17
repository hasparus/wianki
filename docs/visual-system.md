# Visual system

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| wedding-rose | `#F3B0B7` | primary decorative accent |
| wedding-rose-soft | `#F2AEBD` | secondary decorative accent |
| wedding-green | `#2A482F` | text, buttons, borders |
| wedding-green-soft | `#36533A` | hover, secondary green |
| wedding-ivory | `#FBF6EF` | page background |
| wedding-cream | `#FCF8F2` | cards, dialogs |

Contrast: green on ivory ~9.45:1. Rose on green ~5.66:1. Rose on ivory ~1.67:1,
so rose is never ordinary text.

Error, warning, success, disabled, focus, overlay are separate variables in
`app/globals.css`. No automatic dark mode. Reduced-motion kills decorative
transitions.

Slideshow runs on the dark side of the same palette: deep forest background,
rose as glow and as accents on green.

## Interaction

Touch targets >= 44px. Every icon-only control has an accessible name. Dialogs
close by button, backdrop, or Escape. Gallery images use empty alt — no
meaningful caption exists; the surrounding button names the action.
