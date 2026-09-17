# Acacia Fraternity brand reference

Sourced directly from Acacia Fraternity's official materials — not guessed,
not recreated. Keep this file as the reference if the theme ever needs to
change; don't invent new brand colors/fonts without checking here first.

**Sources:**
- [acacia.org/graphics](https://acacia.org/graphics), [/graphics-logo](https://acacia.org/graphics-logo), [/graphics-coat-of-arms](https://acacia.org/graphics-coat-of-arms)
- The official **Acacia Brand Guide (2019)**, linked from [acacia.org/chapter-resources](https://acacia.org/chapter-resources) (Communications & Alumni Relations section) — a 44-page PDF covering history, brand positioning, and visual standards.

## Colors

Primary (use most frequently):

| Name  | PMS      | CMYK          | RGB           | Hex       |
|-------|----------|---------------|---------------|-----------|
| Black | Process Black | 0 0 0 100 | 30 30 30     | `#1E1E1E` |
| Gold  | 106 C    | 0 0 75 0      | 249 229 71    | `#F9E547` |

Complementary (use less frequently):

| Name  | PMS   | CMYK           | RGB         | Hex       |
|-------|-------|----------------|-------------|-----------|
| Green | 327 C | 100 2 60 14    | 0 134 117   | `#008675` |
| Blue  | 548 C | 100 21 28 76   | 0 61 76     | `#003D4C` |

Applied in this app: black + gold carry the primary UI (nav, buttons, the
"A" badge); green is reused for "open/checked-in" success states; blue is
available for any future informational/secondary accent. Defined as CSS
variables in [`src/app/globals.css`](src/app/globals.css) and exposed as
Tailwind utilities (`bg-acacia-gold`, `text-acacia-black`, etc).

## Typography

Acacia's system font is **Founders Grotesk** (Klim Type Foundry) — Bold for
headlines, Semibold for subheadlines, Medium for body copy — with **Neue
Helvetica** as their own documented fallback when custom fonts aren't
available. Both are commercial fonts and can't be freely embedded in a web
app's font bundle.

This app uses **Archivo** (Google Fonts, free) as the closest open
substitute — same grotesque-sans structure and proportions, full weight
range. Loaded via `next/font/google` in
[`src/app/layout.tsx`](src/app/layout.tsx) at weights 500/600/700 to mirror
Founders Grotesk's Medium/Semibold/Bold usage.

## Logo

The primary logo is the wordmark **"Acacia"** set in a custom serif
display face (not Founders Grotesk — logos and body copy use different
type in their system). Acacia's own guidelines are explicit: *"do not
attempt to recreate any letter forms using similar typefaces"* and *"all
reproduction should utilize the official digital artwork available for
download."* We don't have a licensed way to reproduce that exact wordmark,
so this app doesn't try — the word "Acacia" appears in this app's own UI
font (Archivo Bold), not as a fake recreation of their logotype.

What we *do* use is their real, official **"A" mark** — a distinct piece of
artwork Acacia explicitly separates from the Greek letter Alpha ("they
carry different meanings, and the Greek letter should never be used in
place of our Acacia A"). Downloaded directly from acacia.org's graphics
library into [`public/brand/`](public/brand/):
- `acacia-logo-black.svg` — for light backgrounds
- `acacia-logo-white.svg` — for dark backgrounds

Their brand guide's own "Social Media Avatar" spec — the mark centered on
an Acacia-gold circular background with breathing room — is exactly what
[`src/components/acacia-mark.tsx`](src/components/acacia-mark.tsx) and
[`src/app/icon.svg`](src/app/icon.svg) (the browser tab favicon) implement.

**Do not** recolor, distort, stretch, or otherwise alter these SVGs —
Acacia's guide is explicit that "tampering with or altering the logo is
not recommended under any circumstances."

## Coat of Arms / Crest

Per *Pythagoras* (Acacia's membership manual): a gold shield bearing a
fess and two bendlets in black, three gold triangles, a blue ribbon, and
the motto "Human Service" inscribed in Greek (Ωφελούντες Ανθρώπους).
Adopted in its present form in 1927, modernized before the Fraternity's
2004 centennial.

Downloaded directly from acacia.org's graphics library into
[`public/brand/`](public/brand/) (`crest-full-color.png`,
`crest-black.png`) — Acacia only ever ships this artwork on a white
background, so it's always shown inside its own white chip
([`src/components/acacia-crest.tsx`](src/components/acacia-crest.tsx))
regardless of the surrounding theme. Used in the nav header's top-left
corner throughout the app, and as one of the two selectable home-screen
icons in Personalization (see below).

## Personalization: theme and home-screen icon

Two device-level preferences, both stored as cookies (not account data —
matches how most apps treat "is this device in dark mode" as a per-device
setting, not a synced one) and read server-side so there's no flash of
the wrong theme on load:

- **Appearance** (`acacia-theme` cookie: light/dark/system) — sets
  `data-theme` on `<html>` in `src/app/layout.tsx`. CSS variables for
  background/surface/text in `src/app/globals.css` swap under both an
  explicit `[data-theme="dark"]` selector and a
  `prefers-color-scheme: dark` media query (for "system"), with light
  always winning if explicitly chosen — same pattern used for
  theme-aware Artifacts. The four Acacia brand colors themselves
  (black/gold/green/blue) don't change between themes — they're identity,
  not a theme token.
- **Home-screen icon** (`acacia-icon` cookie: mark/crest) — which mark
  shows up if someone adds the app to their phone's home screen. Both
  `src/app/manifest.ts` (Android/Chrome's installable-PWA icons) and the
  `apple-touch-icon` link in `src/app/layout.tsx`'s `generateMetadata`
  (iOS) read this cookie and point at whichever of
  `src/app/icon-mark/route.tsx` / `src/app/icon-crest/route.tsx` matches
  — both dynamically rasterize the real brand assets to PNG at request
  time via `next/og`'s `ImageResponse`, at whatever size the caller asks
  for. **Limitation worth knowing**: phones cache the icon at the moment
  you add the shortcut — changing the preference afterward doesn't
  retroactively update an icon already on the home screen; you have to
  remove and re-add it. Personalization's UI says this explicitly.
