---
name: Academic Carbon Slate
colors:
  surface: '#131313'
  surface-dim: '#131313'
  surface-bright: '#393939'
  surface-container-lowest: '#0e0e0e'
  surface-container-low: '#1c1b1b'
  surface-container: '#201f1f'
  surface-container-high: '#2a2a2a'
  surface-container-highest: '#353534'
  on-surface: '#e5e2e1'
  on-surface-variant: '#c3c6d8'
  inverse-surface: '#e5e2e1'
  inverse-on-surface: '#313030'
  outline: '#8c90a2'
  outline-variant: '#424656'
  surface-tint: '#b4c5ff'
  primary: '#b4c5ff'
  on-primary: '#002979'
  primary-container: '#0f62fe'
  on-primary-container: '#f3f3ff'
  inverse-primary: '#0052dd'
  secondary: '#ffd247'
  on-secondary: '#3d2f00'
  secondary-container: '#e4b601'
  on-secondary-container: '#5d4900'
  tertiary: '#7bdb87'
  on-tertiary: '#003913'
  tertiary-container: '#198038'
  on-tertiary-container: '#d4ffd2'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174c'
  on-primary-fixed-variant: '#003da9'
  secondary-fixed: '#ffe08b'
  secondary-fixed-dim: '#f0c119'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#584400'
  tertiary-fixed: '#96f8a1'
  tertiary-fixed-dim: '#7bdb87'
  on-tertiary-fixed: '#002108'
  on-tertiary-fixed-variant: '#00531e'
  background: '#131313'
  on-background: '#e5e2e1'
  surface-variant: '#353534'
typography:
  display:
    fontFamily: IBM Plex Sans
    fontSize: 42px
    fontWeight: '600'
    lineHeight: 50px
    letterSpacing: -0.01em
  headline-lg:
    fontFamily: IBM Plex Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: IBM Plex Sans
    fontSize: 26px
    fontWeight: '600'
    lineHeight: 34px
    letterSpacing: -0.005em
  headline-md:
    fontFamily: IBM Plex Sans
    fontSize: 24px
    fontWeight: '500'
    lineHeight: 32px
  headline-sm:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '500'
    lineHeight: 24px
  body-lg:
    fontFamily: IBM Plex Sans
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: IBM Plex Sans
    fontSize: 15px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: IBM Plex Sans
    fontSize: 13px
    fontWeight: '400'
    lineHeight: 18px
  label-md:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.02em
  label-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '500'
    lineHeight: 14px
    letterSpacing: 0.04em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
spacing:
  gutter: 1rem
  gutter-desktop: 1.5rem
  margin: 1rem
  margin-desktop: 2rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2.5rem
---

## Brand & Style

This design system delivers a focused, high-precision acoustic interface engineered for auditoriums, research symposiums, and lecture halls. Tailored for students, researchers, and academic professionals, the interface minimizes cognitive friction while managing dense, live-streamed transcripts and metadata.

The aesthetic fuses industrial precision with Carbon-grade utility:
- **Tone:** Academic, exact, disciplined, and distraction-free under dim lecture lighting.
- **Form Factor:** Sharp rectangular geometry, low-profile mechanical dividers, and structural typographic hierarchies.
- **Information Density:** High visual economy prioritizing raw readability, precise timing tags, and instantaneous keypoint triage.

## Colors

The palette employs a deep slate architecture designed to prevent retinal fatigue during multi-hour sessions, punctuated by functional signal accents.

### Core Architecture
- **Canvas Base (`#121212` / `#161616`):** The foundational substrate for long-form reading in low-light environments.
- **Layer 01 (`#262626`):** Modular panels, transcript streams, and sidebars.
- **Layer 02 (`#393939`):** Interactive inputs, active transcript containers, and table headers.
- **Borders & Dividers (`#525252`):** Crisp 1px structural framing.

### Signal Accents
- **Primary Live Stream (`#0f62fe`):** Interactive focus, streaming voice activity indicators, and dynamic audio waves.
- **Highlight Amber (`#f1c21b`):** One-click annotations, key citations, starred thesis blocks, and active review markers.
- **Security & System Green (`#198038` / `#24a148`):** End-to-end encryption confirmation, local storage integrity, and mic permissions.
- **High-Contrast Text (`#f4f4f4` primary, `#c6c6c6` secondary, `#8d8d8d` tertiary):** Tuned for strict WCAG AAA contrast against Carbon slate backdrops.

## Typography

Typography prioritizes rapid scanability and strict temporal tracking.

- **Primary Typeface (IBM Plex Sans):** Serves headlines and lecture transcript flows. Balanced vertical metrics and open counters retain legibility across long-form continuous transcripts.
- **Accompanying Monospace (JetBrains Mono):** Dedicated to technical metadata: acoustic Hz levels, lecture runtime timestamps (`01:24:19.42`), audio confidence ratings, speaker channel demarcations, and keyboard triggers.
- **Rule of Weight:** Never use weights above `600` in dark mode to prevent visual halos and bleed around light text on dark surfaces.

## Layout & Spacing

The system implements a rigid 16-column desktop grid collapsing to an 8-column layout on tablet and a single-column stacked view on mobile.

### Desktop Distribution
- **Sidebar Rail (Fixed, 280px):** Audio input management, chapter index, and session tags.
- **Primary Transcript Column (Fluid, min 640px, max 880px):** Restricted width to maintain 60–75 characters per line for sustained reading comfort.
- **Quick-Action Utility Dock (Fixed, 360px):** Real-time highlights, AI summary cards, and export controls.

### Vertical Rhythm
Built around a strict 8px base unit. Micro-spacing (4px) is strictly preserved for timestamp alignment and label anchors. Component vertical padding remains compact to prioritize screen area for transcript lines.

## Elevation & Depth

This system avoids drop shadows and diffused blur aesthetics. Spatial hierarchy is defined via tonal stepping and high-contrast bounding lines.

- **Surface Levels:**
  - `Level 00 (Canvas):` `#161616` (Deep ground)
  - `Level 01 (Structural Panels):` `#262626`
  - `Level 02 (Interactive Cards & Inputs):` `#393939`
  - `Level 03 (Hover States & Active Floating Overlays):` `#4c4c4c`
- **Boundaries:** 1px solid boundaries using `#393939` for resting states and `#525252` for focused/active states.
- **Active State Elevation:** Interactive components indicate focus and selection through high-contrast boundary changes (e.g., 2px solid `#0f62fe` for focus, `#f1c21b` for active highlights) rather than physical drop shadows.

## Shapes

The geometric framework uses zero-radius edges (`0px`) throughout.

- All containers, inputs, buttons, chips, and modals feature completely sharp, industrial 90-degree corners.
- Precision framing anchors the eye to structured text blocks and timestamps without whimsical softening.
- Status indicators and microphone live pulse lights are the sole circular elements (`rounded-full`), clearly separating functional hardware status from structural UI containers.

## Components

### Buttons
- **Primary Action (Record / Transcribe):** Background `#0f62fe`, text `#ffffff`, square edges, no radius, height 40px (desktop), 48px (touch). Focused state adds a 2px outline with 2px offset (`#ffffff`).
- **Highlight Capture (1-Click Trigger):** Background `#f1c21b`, text `#161616`, font weight 600, JetBrains Mono hotkey tag (`[SPACE]` or `[H]`).
- **Ghost / Tertiary:** Background transparent, border 1px solid `#525252`, hover background `#262626`.

### Inputs & Controls
- **Field Boxes:** Background `#262626`, bottom-border only (2px solid `#525252`), default font IBM Plex Sans. Focus shifts bottom border to `#0f62fe` with `#393939` background.
- **Checkboxes & Radios:** Rigid square boxes (16x16px), 1px solid `#8d8d8d`. Selected state: fill `#0f62fe` with pure white indicator checkmark.

### Live Transcript Feed
- **Streaming Speech Block:** Grouped by timestamp (`label-sm`, `#8d8d8d`) and speaker identifier (`label-md`, `#0f62fe`). Active streaming tokens feature a solid 2px `#0f62fe` blinking caret.
- **Highlighted Line Item:** Applied via 1-click trigger. Receives a 3px vertical border in `#f1c21b` on the left edge, with an ambient row tint (`#f1c21b` at 8% opacity).

### Badges & Chips
- **Privacy Indicator:** Sharp badge, background `#198038` at 15% opacity, border 1px solid `#24a148`, text `#42be65` with a preceding 6px green circular status beacon. Text: `LOCAL ENCLAVE ONLY`.
- **Timestamp Chip:** JetBrains Mono, background `#262626`, border 1px solid `#393939`, text `#c6c6c6`, padding 2px 6px.