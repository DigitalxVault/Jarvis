---
phase: 08
plan: 01
name: PWA Manifest, Icons, and iOS Meta Tags
subsystem: pwa-identity
tags: [pwa, manifest, icons, ios, next.js, sharp]

dependency_graph:
  requires: []
  provides:
    - web-app-manifest
    - pwa-icons-192-512-maskable
    - apple-touch-icon-180
    - layout-pwa-metadata
    - layout-viewport-export
  affects:
    - 08-02  # Service worker will reference manifest and icons
    - 08-03  # Install prompt depends on valid manifest
    - 09-x   # Responsive layout uses same theme colors

tech_stack:
  added:
    - sharp@0.34.5 (icon generation script, pnpm virtual store)
  patterns:
    - Next.js dynamic manifest route (MetadataRoute.Manifest)
    - Next.js Metadata appleWebApp for iOS meta tags
    - Next.js Viewport export for themeColor (separate from Metadata)
    - Separate maskable icon entry (never combined purpose: "any maskable")

file_tracking:
  created:
    - apps/web/src/app/manifest.ts
    - apps/web/scripts/generate-icons.mjs
    - apps/web/public/icons/icon-192x192.png
    - apps/web/public/icons/icon-512x512.png
    - apps/web/public/icons/icon-maskable-512x512.png
    - apps/web/public/icons/apple-touch-icon.png
  modified:
    - apps/web/src/app/layout.tsx

decisions:
  - id: D-801
    choice: "Separate maskable icon entry with purpose: maskable"
    alternatives: ["purpose: any maskable (deprecated/ambiguous)"]
    rationale: "PWA spec recommends separate entries; combined purpose string is non-standard"
    outcome: "Three icon entries: 192 (any), 512 (any), 512 (maskable)"
  - id: D-802
    choice: "theme_color: #010a1a (dark bg) not #00ffff (cyan accent)"
    alternatives: ["cyan accent #00ffff as theme color"]
    rationale: "OS chrome (status bar, title bar) should match app dark background, not flash cyan"
    outcome: "Consistent dark theme across OS UI and app chrome"
  - id: D-803
    choice: "Sharp SVG-to-PNG generation script (generate-icons.mjs)"
    alternatives: ["Manual PNG creation", "Canvas API", "Puppeteer screenshot"]
    rationale: "Sharp is already in pnpm virtual store as Next.js dependency; no new deps needed"
    outcome: "Reproducible icon generation, can regenerate with final brand assets"

metrics:
  duration: "3 minutes"
  completed: "2026-03-04"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 8 Plan 1: PWA Manifest, Icons, and iOS Meta Tags Summary

**One-liner:** Next.js dynamic manifest with `display: standalone` plus 4 sharp-generated JARVIS-branded PNG icons and iOS meta tags in root layout.

## What Was Built

The PWA identity layer: browsers need a valid manifest with icons before offering installation. This plan delivers exactly that.

1. **`apps/web/src/app/manifest.ts`** - Next.js dynamic manifest route returning `MetadataRoute.Manifest` with JARVIS branding (`name: 'JARVIS // DCS Telemetry'`, `display: 'standalone'`, dark theme colors).

2. **4 PNG icons in `apps/web/public/icons/`** - Generated via `scripts/generate-icons.mjs` using sharp (SVG-to-PNG). Each shows dark `#010a1a` background with centered cyan `#00ffff` "J" mark:
   - `icon-192x192.png` (192x192) - standard PWA icon
   - `icon-512x512.png` (512x512) - standard PWA icon
   - `icon-maskable-512x512.png` (512x512) - maskable, J at 50% height to stay in safe zone
   - `apple-touch-icon.png` (180x180) - iOS home screen icon

3. **Updated `apps/web/src/app/layout.tsx`** - Added PWA metadata: `appleWebApp` (capable, black-translucent status bar, title), `mobile-web-app-capable`, `icons.apple` link, and a separate `viewport` export with `themeColor: '#010a1a'`.

## Verification Results

| Check | Result |
|-------|--------|
| `pnpm typecheck` | PASS |
| `icon-192x192.png` dimensions | 192x192 PNG |
| `icon-512x512.png` dimensions | 512x512 PNG |
| `icon-maskable-512x512.png` dimensions | 512x512 PNG |
| `apple-touch-icon.png` dimensions | 180x180 PNG |
| `manifest.ts` has `display: standalone` | PASS |
| No `purpose: "any maskable"` | PASS |
| `layout.tsx` has appleWebApp + viewport | PASS |

## REQ Coverage

| REQ | Description | Status |
|-----|-------------|--------|
| REQ-200 | Manifest with JARVIS branding, all required fields | DONE |
| REQ-201 | Three PWA icons (192, 512, 512 maskable) as valid PNGs | DONE |
| REQ-202 | Apple touch icon (180x180), iOS meta tags in layout | DONE |
| REQ-214 | `display: standalone` enables chromeless launch | DONE |

## Commits

| Hash | Message |
|------|---------|
| 328887e | feat(08-01): generate placeholder JARVIS-branded PWA icons |
| 1f2bc5c | feat(08-01): create PWA manifest and update layout with PWA meta tags |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Sharp not resolvable via standard `require('sharp')` from scripts directory**

- **Found during:** Task 1 (first run of generate-icons.mjs)
- **Issue:** pnpm virtual store places sharp at `.pnpm/sharp@0.34.5/node_modules/sharp` — not linked as a top-level symlink in `node_modules/`, so standard `require('sharp')` fails from a script file not inside `node_modules`
- **Fix:** Updated `generate-icons.mjs` to use `createRequire` with the web app `package.json` as base, with a fallback to the explicit pnpm virtual store path if standard resolution fails
- **Files modified:** `apps/web/scripts/generate-icons.mjs`
- **Commit:** 328887e (included in same commit)

## Next Phase Readiness

**Phase 8 Plan 2 (Service Worker)** can proceed immediately:
- Manifest is live at `/manifest.webmanifest` (Next.js serves `manifest.ts` automatically)
- Icons are at stable paths `/icons/icon-*.png`
- No blocking issues

**Note for icon refresh:** `generate-icons.mjs` is a utility script for regeneration. When final brand assets are available, run `node apps/web/scripts/generate-icons.mjs` to replace placeholders. The script produces reproducible output.
