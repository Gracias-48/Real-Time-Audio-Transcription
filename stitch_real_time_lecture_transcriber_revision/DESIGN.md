---
name: Academic Dashboard
colors:
  surface: '#f8f9ff'
  surface-dim: '#cbdbf5'
  surface-bright: '#f8f9ff'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#eff4ff'
  surface-container: '#e5eeff'
  surface-container-high: '#dce9ff'
  surface-container-highest: '#d3e4fe'
  on-surface: '#0b1c30'
  on-surface-variant: '#434655'
  inverse-surface: '#213145'
  inverse-on-surface: '#eaf1ff'
  outline: '#737686'
  outline-variant: '#c3c6d7'
  surface-tint: '#0053db'
  primary: '#004ac6'
  on-primary: '#ffffff'
  primary-container: '#2563eb'
  on-primary-container: '#eeefff'
  inverse-primary: '#b4c5ff'
  secondary: '#565e74'
  on-secondary: '#ffffff'
  secondary-container: '#dae2fd'
  on-secondary-container: '#5c647a'
  tertiary: '#006329'
  on-tertiary: '#ffffff'
  tertiary-container: '#007f36'
  on-tertiary-container: '#c7ffca'
  error: '#ba1a1a'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#dbe1ff'
  primary-fixed-dim: '#b4c5ff'
  on-primary-fixed: '#00174b'
  on-primary-fixed-variant: '#003ea8'
  secondary-fixed: '#dae2fd'
  secondary-fixed-dim: '#bec6e0'
  on-secondary-fixed: '#131b2e'
  on-secondary-fixed-variant: '#3f465c'
  tertiary-fixed: '#7ffc97'
  tertiary-fixed-dim: '#62df7d'
  on-tertiary-fixed: '#002109'
  on-tertiary-fixed-variant: '#005320'
  background: '#f8f9ff'
  on-background: '#0b1c30'
  surface-variant: '#d3e4fe'
typography:
  display:
    fontFamily: Inter
    fontSize: 36px
    fontWeight: '700'
    lineHeight: 44px
    letterSpacing: -0.025em
  headline-lg:
    fontFamily: Inter
    fontSize: 30px
    fontWeight: '600'
    lineHeight: 38px
    letterSpacing: -0.02em
  headline-lg-mobile:
    fontFamily: Inter
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
    letterSpacing: -0.015em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: 28px
    letterSpacing: -0.015em
  headline-sm:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '600'
    lineHeight: 24px
    letterSpacing: -0.01em
  body-lg:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
    letterSpacing: -0.005em
  body-md:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
    letterSpacing: 0em
  body-sm:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '400'
    lineHeight: 16px
    letterSpacing: 0em
  label-lg:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '500'
    lineHeight: 20px
    letterSpacing: -0.005em
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.01em
  code-metric:
    fontFamily: JetBrains Mono
    fontSize: 13px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: -0.01em
  code-metric-sm:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '400'
    lineHeight: 14px
    letterSpacing: 0em
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  gutter: 1.5rem
  gutter-mobile: 1rem
  margin: 2rem
  margin-mobile: 1rem
  space-xs: 0.25rem
  space-sm: 0.5rem
  space-md: 1rem
  space-lg: 1.5rem
  space-xl: 2rem
---

## Brand & Style

This design system establishes an intellectual, highly disciplined interface calibrated for higher education institutions, scientific registries, and institutional research management. The aesthetic blends the engineered precision of modern component architectures with the understated authority of an academic press. 

The visual tone is rigorous, reliable, and unobtrusive. It strips away ornamental distraction in favor of immaculate typographical scale, structured data density, and deliberate visual hierarchies. Interactions prioritize clarity and high-efficiency workflows: grading pipelines, research telemetry, longitudinal grant trackers, and departmental metrics. The design style relies on Modern Institutional Minimalism—leveraging razor-thin structural borders, precise spatial increments, soft matte background plains, and disciplined semantic alerts.

## Colors

The palette is tuned specifically for light-mode visual ergonomics during extended analytical sessions. 

- **Canvas & Backgrounds:** The underlying canvas is fixed at Slate-50 (`#f8fafc`). Elevated card containers and modal layers utilize absolute pure white (`#ffffff`) to construct crisp contrast against the base canvas.
- **Structural Outlines:** Neutral borders use Slate-200 (`#e2e8f0`) as the primary partition line, keeping structural edges clear without dominating visual flow. Subtler interior table row dividers drop to Slate-100 (`#f1f5f9`).
- **Primary & Interactive:** Deep Royal Blue (`#2563eb`) serves as the active primary color, applied purposefully for primary actions, focus rings, selected navigation nodes, and active state highlights.
- **Typography & Dark Neutrals:** The dominant typographical color is Slate-900 (`#0f172a`) for display headings and critical readings. Secondary body copy, supporting descriptive text, and metadata utilize Slate-800 (`#1e293b`) and Slate-500 (`#64748b`).
- **Semantic Feedback:**
  - **Success / Peer-reviewed:** Emerald-600 (`#16a34a`) paired with Emerald-50 (`#ecfdf5`) backgrounds.
  - **Warning / Review Required:** Amber-600 (`#d97706`) paired with Amber-50 (`#fffbeb`) backgrounds.
  - **Destructive / Flagged:** Rose-600 (`#e11d48`) paired with Rose-50 (`#fff1f2`) backgrounds.
  - **Informational / Quantitative:** Royal Blue (`#2563eb`) paired with Blue-50 (`#eff6ff`).

## Typography

The typography system uses **Inter** for all prose, headings, and interactive labels, pairing it with **JetBrains Mono** for tabular numbers, DOI citations, student IDs, currency calculations, and telemetry badges.

- **Weight Discipline:** Weight is kept strictly restrained. Primary headings favor semi-bold (`600`) over heavy bold, preventing large type from overpowering surrounding data grids. Body copy stays consistently at regular (`400`), while structural controls (buttons, tabs, table column headers) use medium (`500`).
- **Tracking & Proportion:** Tighter letter spacing (negative tracking) is applied on headings (`-0.025em` down to `-0.01em`) to maintain editorial density reminiscent of published technical journals.
- **Monospace Pairing:** Any value subject to comparison (grade point averages, percentages, statistical margins, timestamps) defaults to `code-metric` or `code-metric-sm` to maintain vertical decimal alignment across multi-line tables.

## Layout & Spacing

The layout is structured on a 12-column responsive fluid grid with deliberate max-width boundaries for widescreen workstations (`1440px` standard container).

- **Grid Rhythms:**
  - **Desktop (1024px+):** 12 columns with `1.5rem` (`24px`) gutters and `2rem` (`32px`) margins. Sidebar controls occupy a fixed `16rem` (`256px`) or `18rem` (`288px`) vertical track, leaving the main content area fluid.
  - **Tablet (768px - 1023px):** 8 columns with `1.25rem` (`20px`) gutters and `1.5rem` (`24px`) margins. Sidebars collapse to icon-only rails or overlay sheets.
  - **Mobile (<768px):** 4 columns with `1rem` (`16px`) gutters and `1rem` (`16px`) exterior margins. Multi-column metric bands stack vertically into singular full-width cards.
- **Spatial Scale Rules:** Internal component spacing follows a mathematical 4px/8px modular base. Compact table density utilizes `space-xs` and `space-sm` for row cells, while card padding defaults to `space-lg` (`1.5rem`) to maintain breathable structural isolation.

## Elevation & Depth

Visual hierarchy is communicated through **tonal separation coupled with hairline outlines** rather than deep spatial shadows.

- **Surface Levels:**
  - **Level 0 (Canvas):** Slate-50 (`#f8fafc`), completely flat.
  - **Level 1 (Cards, Data Panels, Modules):** Solid pure white (`#ffffff`) bounded by a continuous 1px solid border of Slate-200 (`#e2e8f0`). A micro-shadow provides subtle separation: `0 1px 3px 0 rgba(15, 23, 42, 0.04), 0 1px 2px -1px rgba(15, 23, 42, 0.03)`.
  - **Level 2 (Dropdowns, Popovers, Filter Menus):** Pure white (`#ffffff`), 1px solid Slate-200 border, elevated with an ambient dropdown shadow: `0 4px 6px -1px rgba(15, 23, 42, 0.06), 0 2px 4px -2px rgba(15, 23, 42, 0.04)`.
  - **Level 3 (Modals, Slide-over Panels):** Floating white surfaces overlaid on an attenuated backdrop of Slate-900 with 40% opacity (`rgba(15, 23, 42, 0.40)`). Shadow: `0 20px 25px -5px rgba(15, 23, 42, 0.08), 0 8px 10px -6px rgba(15, 23, 42, 0.04)`.

## Shapes

The geometric framework follows a **Soft (Level 1)** structure, ensuring interface components look crisp, engineered, and contemporary without drifting into casual rounded forms.

- **Base Corner Radius (0.25rem / 4px):** Standard controls, code badges, input fields, checkboxes, tabs, and table inner selections.
- **Card and Panel Radius (0.5rem / 8px - `rounded-lg`):** Dashboard tiles, analytical charts, data tables, dialog windows, and modal panels.
- **Outer Shell Containers (0.75rem / 12px - `rounded-xl`):** Primary canvas containment blocks, elevated split-view parent frames, and top-level workspace wrappers.
- **Pill Exception (9999px):** Restricted entirely to categorical status badges, peer-review state tags, and avatar placeholders.

## Components

### Buttons
- **Primary:** Solid `#2563eb` fill, `#ffffff` text, font weight `500`. Hover state transitions to `#1d4ed8`. Height: 36px (`sm`) or 40px (`md`). Border radius: 6px. Focus ring: 2px offset with 2px `#2563eb`.
- **Secondary:** White fill (`#ffffff`), 1px solid `#e2e8f0`, text `#0f172a`. Hover state: `#f8fafc` background with `#cbd5e1` border.
- **Ghost:** Transparent fill, `#1e293b` text. Hover: `#f1f5f9`.
- **Destructive:** White fill, 1px solid `#fecdd3`, text `#e11d48`. Hover: `#fff1f2`.

### Metric Chips & Status Badges
- Constructed with horizontal inline padding (`0.5rem`), vertical padding (`0.125rem`), and pill-shaped or 4px radii.
- **Monospace Metric Tags:** JetBrains Mono font (`code-metric-sm`), Slate-100 fill, Slate-700 text, 1px solid Slate-200 border.
- **Semantic Badges:**
  - *Active / Published:* Emerald-50 background, Emerald-700 text, Emerald-200 border. Includes a 6px solid Emerald-500 indicator dot.
  - *Pending / Audit:* Amber-50 background, Amber-800 text, Amber-200 border.
  - *Flagged / Withdrawn:* Rose-50 background, Rose-700 text, Rose-200 border.

### Input Fields & Controls
- **Text Inputs:** Height 38px, pure white surface, 1px solid `#e2e8f0` border, `rounded-md` (6px). Placeholder text in `#94a3b8`. Focus state shifts border to `#2563eb` with a 1px matching ring.
- **Checkboxes & Radios:** 16px square/circle with a 1px `#cbd5e1` border. Checked state fills `#2563eb` with a white checkmark icon. Smooth 100ms transition.

### Cards & Analytical Panels
- White background (`#ffffff`), 1px solid `#e2e8f0`, radius `rounded-lg` (8px).
- Internal layout consists of an explicit header zone separated by an optional interior 1px divider, with a title (`headline-sm`), an action utility slot (date range picker or export icon), a metric body area, and an optional monospace footnote displaying sample sizes or confidence intervals.

### Data Tables
- Flush full-width table containers within cards.
- **Header Row:** Background `#f8fafc`, 1px solid bottom border `#e2e8f0`, typography `label-md` uppercase with `0.05em` tracking, color `#64748b`.
- **Data Rows:** Background `#ffffff`, alternating with hover state `#f8fafc`. Cells padded with `0.75rem 1rem`. Numerical and date fields explicitly right-aligned using `JetBrains Mono`.

### Academic-Specific Additions
- **Citation Quotation Box:** Subtle left border accent (3px solid `#2563eb`), background Slate-50/50, containing copyable text and a one-click BibTeX/APA export pill.
- **Progress Trackers:** 6px slim track bar with Slate-100 background and Royal Blue `#2563eb` fill for grant milestone execution and curriculum completion stages.