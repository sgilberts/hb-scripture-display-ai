---
name: HallelujahBeamer Control
colors:
  surface: '#131316'
  surface-dim: '#131316'
  surface-bright: '#39393c'
  surface-container-lowest: '#0e0e11'
  surface-container-low: '#1b1b1e'
  surface-container: '#1f1f22'
  surface-container-high: '#2a2a2d'
  surface-container-highest: '#353438'
  on-surface: '#e4e1e6'
  on-surface-variant: '#bbcabf'
  inverse-surface: '#e4e1e6'
  inverse-on-surface: '#303033'
  outline: '#86948a'
  outline-variant: '#3c4a42'
  surface-tint: '#4edea3'
  primary: '#4edea3'
  on-primary: '#003824'
  primary-container: '#10b981'
  on-primary-container: '#00422b'
  inverse-primary: '#006c49'
  secondary: '#ffb95f'
  on-secondary: '#472a00'
  secondary-container: '#ee9800'
  on-secondary-container: '#5b3800'
  tertiary: '#b9c7e0'
  on-tertiary: '#233144'
  tertiary-container: '#95a4bb'
  on-tertiary-container: '#2c3a4e'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6ffbbe'
  primary-fixed-dim: '#4edea3'
  on-primary-fixed: '#002113'
  on-primary-fixed-variant: '#005236'
  secondary-fixed: '#ffddb8'
  secondary-fixed-dim: '#ffb95f'
  on-secondary-fixed: '#2a1700'
  on-secondary-fixed-variant: '#653e00'
  tertiary-fixed: '#d5e3fd'
  tertiary-fixed-dim: '#b9c7e0'
  on-tertiary-fixed: '#0d1c2f'
  on-tertiary-fixed-variant: '#3a485c'
  background: '#131316'
  on-background: '#e4e1e6'
  surface-variant: '#353438'
  status-online: '#4edea3'
  status-emergency: '#93000a'
  live-preview-bg: '#000000'
typography:
  display-lg:
    fontFamily: Inter
    fontSize: 32px
    fontWeight: '700'
    lineHeight: '1.1'
    letterSpacing: -0.02em
  headline-md:
    fontFamily: Inter
    fontSize: 20px
    fontWeight: '600'
    lineHeight: '1.2'
    letterSpacing: -0.01em
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: '1.5'
  label-caps:
    fontFamily: JetBrains Mono
    fontSize: 11px
    fontWeight: '600'
    lineHeight: '1.0'
    letterSpacing: 0.05em
  code-sm:
    fontFamily: JetBrains Mono
    fontSize: 12px
    fontWeight: '400'
    lineHeight: '1.4'
  status-nano:
    fontFamily: Inter
    fontSize: 9px
    fontWeight: '500'
    lineHeight: '1.0'
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  gutter: 8px
  component-gap: 4px
  panel-margin: 1px
  container-padding: 12px
---

## Brand & Style
The brand identity is rooted in **Industrial Minimalism** and **Technical Utility**. It is designed for high-stakes, real-time environments where precision, legibility, and status monitoring are paramount. 

The visual style is a blend of **Brutalism** and **Modern Corporate**, characterized by sharp structural lines, high-contrast status indicators, and a dense, information-rich layout. The interface prioritizes functional density over decorative whitespace, evoking a professional command-and-control aesthetic similar to audio workstations or avionics displays. The emotional response is one of reliability, focus, and technical mastery.

## Colors
The palette is centered around a "Matrix Green" primary color used for active states and critical success indicators. 

- **Primary (#10b981):** Represents "Live" status, active selection, and system health.
- **Secondary (#f59e0b):** Reserved for cautionary states, secondary toggles (e.g., Verse Lock), and specific semantic matches.
- **Backgrounds:** Utilizes a tiered dark-mode strategy. The true black (#000000) is reserved exclusively for media viewports to maximize perceived contrast of video content. Functional surfaces use varying shades of charcoal and deep slate.
- **Accents:** Semantic red is utilized sparingly but aggressively for "Emergency Stop" or critical error states.

## Typography
The system employs a dual-font strategy. **Inter** provides high legibility for UI controls and headings, while **JetBrains Mono** is used for all technical readouts, labels, and system logs to reinforce the "Control Node" aesthetic.

Typography is often treated with uppercase styling and wide letter-spacing for labels to distinguish metadata from content. A specialized "status-nano" size (9px) is used for secondary navigation labels and micro-indicators to maintain high information density without sacrificing the core layout structure.

## Layout & Spacing
The layout utilizes a **tight-grid panel system**. Instead of traditional whitespace, panels are separated by 1px borders (`panel-margin`) of a contrasting outline color, creating a "tiled" or "dashboard" effect.

- **Structure:** A fixed top bar (64px) and a fixed slim sidebar (80px) frame the main workspace. 
- **Main Workspace:** A 12-column fluid grid where internal components use `container-padding` (12px) for internal breathing room. 
- **Responsiveness:** On smaller screens, the sidebar collapses to icons only, and the 3-column main layout stacks into a single-column vertical scroll.

## Elevation & Depth
Depth is communicated through **Tonal Layering** and **Structural Outlines** rather than shadows. 

- **Level 0 (Background):** The darkest surfaces (`surface-container-lowest`).
- **Level 1 (Panels):** `surface-container` with `outline-variant` borders.
- **Level 2 (Active/Hover):** `surface-bright` or `surface-container-high`.
- **Interactions:** Subtle inner glows (glow-sm) are used for active "Live" indicators to simulate physical LEDs. Shadows are omitted entirely to maintain the crisp, flat, technical feel, except for active state pulses on critical buttons.

## Shapes
The shape language is **Strict and Geometric**. Standard components use a 2px (`0.125rem`) radius to soften the corners just enough for modern legibility while maintaining a blocky, industrial appearance. 

Status chips and small indicator lights use circular (full) rounding to stand out against the otherwise rectangular environment. Large containers and main panels should never use high rounding values; they must feel like solid architectural blocks.

## Components
- **Buttons:** Primary buttons are high-contrast (Green/Black). Secondary buttons use a "Glass-Border" style (Transparent background with a visible border). All buttons use uppercase `label-caps` typography.
- **Inputs & Selects:** Dark-filled (`surface-dim`) with a persistent border. Focus states use a 1px primary-color ring.
- **Toggles:** Minimalist pill-shaped tracks with a high-contrast circular thumb.
- **Meters:** Segmented or smooth progress bars within a recessed (`surface-dim`) track.
- **Monitoring Tiles:** Black backgrounds for viewports, often with "Overlays" in the top-left or top-right using `label-caps` for source identification.
- **Data Lists:** High-density rows with `1px` separators and hover-state highlights.