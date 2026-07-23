# Visual System

## Tokens

| Token | Value | Role |
| --- | --- | --- |
| wedding-rose | `#F3B0B7` | Primary decorative accent |
| wedding-rose-soft | `#F2AEBD` | Secondary decorative accent |
| wedding-green | `#2A482F` | Text, buttons, borders |
| wedding-green-soft | `#36533A` | Hover and secondary green |
| wedding-ivory | `#FBF6EF` | Page background |
| wedding-cream | `#FCF8F2` | Cards and dialogs |

Forest green on ivory is approximately 9.45:1 contrast. Rose on forest green is
approximately 5.66:1. Rose on ivory is only approximately 1.67:1 and therefore
must not be ordinary text.

Semantic error, warning, success, disabled, focus, and overlay values live as
separate variables in `app/globals.css`. The interface never follows automatic
dark mode. Reduced-motion preferences disable decorative transitions.

## Interaction

Touch targets are at least 44px high. Every icon-only control has an accessible
name. Dialogs close by explicit button, backdrop click, or Escape. Gallery
images use empty alt text because no meaningful caption exists; the surrounding
button names the enlargement action.
