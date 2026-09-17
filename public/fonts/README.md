# Instrument Serif

Vendored so a clean checkout builds with no network access to a font provider
(see AGENTS.md, "Required quality gate"). Both Latin subsets ship: Polish needs
latin-ext for ą ć ę ł ń ó ś ź ż. Upright only — the visual system sets no
italic, so the italic subsets are deliberately absent.

Loaded by `app/layout.tsx` through `next/font/local` as `--font-instrument-serif`,
which `app/globals.css` reads as `--font-serif`.

Source: https://fonts.google.com/specimen/Instrument+Serif
Designers: Rodrigo Fuenzalida, Jordan Egstad
Licence: SIL Open Font License 1.1 — https://openfontlicense.org/
