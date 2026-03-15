# Phase 13: Responsive Layout - Research

**Researched:** 2026-03-15
**Domain:** Responsive CSS, Tailwind v4 breakpoints, touch events, canvas scaling, PWA safe areas
**Confidence:** HIGH (Tailwind v4 docs, Next.js docs, MDN verified; codebase read directly)

---

## Summary

Phase 13 adds three-breakpoint responsive behavior (mobile/tablet/desktop) to the existing custom CSS-transform drag system from Phase 12. The codebase has zero responsive infrastructure today — the dashboard is a hard-coded `grid-cols-[240px_1fr_200px]` that collapses on small screens.

The standard approach for this project is pure CSS + Tailwind v4 breakpoints: no new npm dependencies, no media-query React hooks (which cause SSR hydration mismatches), and no changes to the drag system internals. Breakpoint switching is handled by CSS media queries in class names, not JavaScript. The drag system is simply disabled (CSS `pointer-events: none`, edit button hidden) at the mobile breakpoint.

Canvas instruments have hard-coded pixel dimensions (ADI: 180x180, G-meter: 120x220, VVI: 120x200, Engine: 200x140). The locked decision is: on mobile (<640px) canvas instruments are REPLACED with Courier New / JARVIS-styled text fallbacks; on tablet they render as-is inside a proportionally scaled layout.

**Primary recommendation:** Use Tailwind v4 responsive prefixes (`sm:`, `lg:`) directly on the existing JSX, add safe-area custom utilities to `globals.css`, and update the `viewport` export in `layout.tsx` with `viewportFit: 'cover'`.

---

## Standard Stack

### Core (already in project)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| Tailwind CSS | 4.2.1 | Responsive utility classes | Already installed, v4 has built-in container queries |
| Next.js Viewport API | 16.1.6 | `viewport` export for `viewportFit`, `width` | Server Component, no JS, correct output |
| CSS `env()` | Web standard | `safe-area-inset-*` padding | No library needed |
| Pointer Events API | Web standard | Touch + mouse unified drag | Already used in `DraggablePanel` |

### No New Dependencies Needed

Phase 13 requires zero new npm packages. All needed primitives are:
- Tailwind v4 responsive prefixes (already available)
- CSS `@layer utilities` for safe-area helpers (globals.css addition)
- `viewport` export update in `layout.tsx` (one field addition)
- CSS `touch-action: none` on drag handles

**Installation:** None required.

---

## Architecture Patterns

### Tailwind v4 Breakpoints (Verified)

Default breakpoints match the REQ-218 spec exactly:

| Prefix | Width | Maps to |
|--------|-------|---------|
| (none) | all sizes — mobile first | mobile (<640px) layout |
| `sm:` | ≥640px (40rem) | tablet start |
| `lg:` | ≥1024px (64rem) | desktop start |

The project needs only `sm` and `lg`. No custom breakpoints required.

**Mobile-first pattern:**
```tsx
// Default (mobile) styles, overridden at sm and lg
<div className="flex flex-col sm:grid sm:grid-cols-[240px_1fr_200px] lg:grid-cols-[240px_1fr_280px]">
```

### Recommended Project Structure for Phase 13

No new files for breakpoints — all changes are in-place on existing components. One new hook file for orientation if needed.

```
apps/web/src/
├── app/
│   ├── globals.css          # Add safe-area utility classes
│   └── layout.tsx           # Update viewport export
├── components/
│   ├── dashboard.tsx        # Main responsive grid rewiring
│   ├── top-bar.tsx          # Compact mobile top bar
│   ├── bottom-bar.tsx       # Safe area padding, hide on mobile
│   ├── draggable-panel.tsx  # Add touch-action: none for edit mode
│   └── instruments/
│       ├── adi.tsx          # Text fallback rendered when isMobile
│       ├── g-meter.tsx      # Text fallback rendered when isMobile
│       ├── vvi-tape.tsx     # Text fallback rendered when isMobile
│       └── engine-panel.tsx # Text fallback rendered when isMobile
└── hooks/
    └── use-is-mobile.ts     # SSR-safe breakpoint hook (only if needed)
```

### Pattern 1: Dashboard Grid Layout Switching

The dashboard `grid-cols-[240px_1fr_200px]` must collapse on mobile to a single column.

```tsx
// Source: Tailwind v4 docs (verified)
// In dashboard.tsx — the main content area
<div className="flex-1 flex flex-col sm:grid sm:grid-cols-[240px_1fr_200px] min-h-0 bg-jarvis-bg">
  {/* Left panel — full width on mobile, 240px on sm+ */}
  <div className="bg-jarvis-bar sm:border-r border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
    {/* ... panels ... */}
  </div>

  {/* Center panel — shown on tablet+, hidden on mobile unless no instruments */}
  <div className="hidden sm:flex relative flex-col min-h-0 overflow-hidden">
    {/* ... center HUD ... */}
  </div>

  {/* Right panel — hidden on mobile (instrument content merged to left column) */}
  <div className="hidden sm:flex bg-jarvis-bar sm:border-l border-jarvis-border p-2 flex-col gap-2">
    {/* ... right instruments ... */}
  </div>
</div>
```

### Pattern 2: Canvas Text Fallback Pattern

Canvas instruments have fixed pixel dimensions. On mobile, a sibling text component renders instead.

```tsx
// Source: CONTEXT.md decision + canvas pixel-size analysis
// In ADI, GMeter, VVITape, EnginePanel — add a text fallback alongside

interface ADIProps {
  pitchRad: number
  bankRad: number
  className?: string
}

export function ADI({ pitchRad, bankRad }: ADIProps) {
  const pitchDeg = Math.round(pitchRad * 57.2958)
  const bankDeg  = Math.round(bankRad  * 57.2958)

  return (
    <>
      {/* Canvas: hidden on mobile (sm: shows it) */}
      <canvas
        ref={canvasRef}
        width={180}
        height={180}
        className="hidden sm:block"
        style={{ imageRendering: 'pixelated' }}
      />
      {/* Text fallback: visible on mobile only */}
      <div className="sm:hidden jarvis-panel text-center py-2">
        <div className="text-[11px] opacity-50 tracking-widest">ATT</div>
        <div className="text-2xl font-bold text-jarvis-accent tabular-nums">
          P {pitchDeg > 0 ? '+' : ''}{pitchDeg}°
        </div>
        <div className="text-2xl font-bold text-jarvis-accent tabular-nums">
          B {bankDeg > 0 ? 'R' : 'L'}{Math.abs(bankDeg)}°
        </div>
      </div>
    </>
  )
}
```

The same pattern applies to GMeter (show G value), VVI (show FPM value), EnginePanel (show RPM%).

### Pattern 3: Viewport and Safe Area Setup

```tsx
// Source: Next.js docs (verified) — apps/web/src/app/layout.tsx
import type { Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: '#010a1a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',  // ADDED — enables env(safe-area-inset-*)
}
```

```css
/* Source: MDN env() + Tailwind v4 @layer pattern — globals.css */
@layer utilities {
  /* Safe area padding helpers */
  .safe-pt { padding-top: env(safe-area-inset-top, 0px); }
  .safe-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-pl { padding-left: env(safe-area-inset-left, 0px); }
  .safe-pr { padding-right: env(safe-area-inset-right, 0px); }

  /* Combined: apply all four sides */
  .safe-insets {
    padding-top: env(safe-area-inset-top, 0px);
    padding-right: env(safe-area-inset-right, 0px);
    padding-bottom: env(safe-area-inset-bottom, 0px);
    padding-left: env(safe-area-inset-left, 0px);
  }
}
```

Apply to top bar and bottom bar:
```tsx
// top-bar.tsx
<div className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-6 h-[52px] safe-pt safe-pl safe-pr z-50">
```

```tsx
// bottom-bar.tsx — bottom bar has the home indicator risk on iOS PWA
<div className="bg-jarvis-bar border-t border-jarvis-border flex items-center px-4 h-[50px] safe-pb safe-pl safe-pr">
```

### Pattern 4: Disabling Drag on Mobile

The `DraggablePanel` uses pointer events. On mobile, drag must be disabled and the edit mode toolbar hidden.

```tsx
// DraggablePanel.tsx — add touch-action: none only in edit mode
<div
  ref={elRef}
  data-panel-id={panelId}
  className={`${editMode ? 'panel-edit-mode' : ''} ${className}`}
  style={{
    transform: `translate(${offset.dx}px, ${offset.dy}px)`,
    position: 'relative',
    zIndex: editMode ? 10 : undefined,
    // touch-action: none prevents iOS scroll-blocking passive listener warning
    // only apply when edit mode is active (drag handle in use)
    touchAction: editMode ? 'none' : 'auto',
  }}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
>
  {children}
</div>
```

In `dashboard.tsx`, hide the edit mode button and toolbar on mobile:
```tsx
// TopBar — pass isMobileLayout prop, hide LAYOUT button on mobile
{onToggleEditMode && (
  <button
    onClick={onToggleEditMode}
    className={`hidden sm:inline-flex px-3 py-1.5 ...`}  // hidden below sm
  >
    LAYOUT
  </button>
)}

// Edit mode toolbar
{editMode && (
  <div className="hidden sm:flex bg-jarvis-bar border-b border-jarvis-accent/30 ...">
    {/* Edit toolbar — not shown on mobile, drag is disabled anyway */}
  </div>
)}
```

Also: force `editMode` to false when on mobile to avoid stale state:
```tsx
// Dashboard.tsx — compute effective editMode
const [editMode, setEditMode] = useState(false)
// editMode is irrelevant on mobile; DraggablePanel ignores it when editMode=false
```

Since `DraggablePanel.onPointerDown` already guards with `if (!editMode) return`, no behavior change is needed in the drag logic itself — just ensuring `editMode` is `false` (which is the default).

### Pattern 5: Mobile Single-Column Priority Layout

On mobile, the 3-column layout collapses to a single vertical stack. Priority per CONTEXT.md:

1. Mini telemetry strip (IAS, ALT, HDG, Mach) — text-only, not card UI
2. ADI text fallback (pitch + bank compact text)
3. Fuel gauge (CollapsibleWidget, expanded by default on mobile)
4. G-meter text fallback
5. Connection status (collapsed by default on mobile via `initialOpen: false`)
6. Engine, AoA, VVI (collapsed via CollapsibleWidget)

`CollapsibleWidget` uses `localStorage.getItem(`jarvis.panel.${panelId}`) !== 'collapsed'` to determine initial open state. On mobile, non-priority panels should default to collapsed. Two options:

- **Option A:** Pass `defaultOpen` prop to `CollapsibleWidget` that overrides the localStorage default when no stored value exists. This is clean — if user explicitly expanded on a prior visit, their preference is remembered.
- **Option B:** Reset localStorage on breakpoint change. This is disruptive.

**Recommended: Option A.** Add `defaultOpen?: boolean` prop (default `true`) to `CollapsibleWidget`:

```tsx
// collapsible-widget.tsx
const [isExpanded, setIsExpanded] = useState<boolean>(() => {
  if (typeof window === 'undefined') return defaultOpen ?? true
  const stored = localStorage.getItem(`jarvis.panel.${panelId}`)
  if (stored !== null) return stored !== 'collapsed'
  return defaultOpen ?? true  // use prop only when no stored preference
})
```

Then in dashboard, pass `defaultOpen={false}` to low-priority panels:
```tsx
<CollapsibleWidget panelId="engine" title="ENGINE" defaultOpen={false}>
```

But this affects ALL breakpoints. The cleaner solution is to accept that on desktop `defaultOpen` is always `true`, and on mobile the user can expand panels as needed. Since localStorage persists per-browser, a phone user who collapses something stays collapsed, which is correct behavior.

### Pattern 6: Mobile Top Bar Compaction

The top bar at `h-[52px]` with full navigation, clock, and edit button is too wide for mobile.

```tsx
// top-bar.tsx — compact on mobile
<div className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-3 sm:px-6 h-[44px] sm:h-[52px] safe-pt safe-pl safe-pr z-50">

  {/* Logo — compact on mobile */}
  <div>
    <div className="text-[12px] sm:text-[14px] font-bold glow-text" style={{ letterSpacing: '4px' }}>
      J·A·R·V·I·S
    </div>
    <div className="hidden sm:block text-[12px] opacity-50" style={{ letterSpacing: '2px' }}>
      TACTICAL HUD v2.0
    </div>
  </div>

  {/* Nav — icon-only on mobile or hidden (connection pill becomes the only status) */}
  <div className="hidden sm:flex gap-2">
    {/* Full nav links */}
  </div>

  {/* Status — connection status pill always visible */}
  <div className="flex items-center gap-2 sm:gap-4">
    {/* LAYOUT button hidden on mobile */}
    {onToggleEditMode && (
      <button className="hidden sm:inline-flex ...">LAYOUT</button>
    )}
    <ConnectionStatus state={connectionState} />
    {/* Clock hidden on mobile */}
    <div className="hidden sm:block text-right">
      <div className="text-lg font-bold glow-text tabular-nums">{clock}</div>
      <div className="text-[12px] opacity-50">{date}</div>
    </div>
  </div>
</div>
```

### Pattern 7: Per-Breakpoint localStorage Strategy

The drag positions use `dx/dy` offsets from the panel's CSS grid position. On mobile, panels are in a single column (no grid), so offsets stored from desktop will misplace panels on mobile.

**Decision: Per-breakpoint storage keys.**

The current storage key is `jarvis-panel-positions-v1`. Add a breakpoint suffix at runtime:

```ts
// use-panel-positions.ts — breakpoint-aware storage
function getStorageKey(): string {
  if (typeof window === 'undefined') return 'jarvis-panel-positions-desktop-v1'
  const w = window.innerWidth
  if (w < 640) return 'jarvis-panel-positions-mobile-v1'
  if (w < 1024) return 'jarvis-panel-positions-tablet-v1'
  return 'jarvis-panel-positions-desktop-v1'
}
```

However, since drag is DISABLED on mobile (<640px), only tablet and desktop keys actually matter. On tablet the layout is a scaled 3-column (same grid structure), so desktop positions would be partially usable — but it's cleaner to keep them separate since the column widths differ.

**Simplest approach:** Keep drag only on desktop (`lg:` breakpoint and above). Tablet uses fixed layout, same as mobile. This eliminates the per-breakpoint key complexity. Revisit if tablet drag is explicitly requested.

**Updated CONTEXT.md decision D-1300 (clarification):**
The CONTEXT says "Drag/edit mode available on tablet (640-1024px) — same experience as desktop." This means tablet drag IS required. Use separate storage keys for tablet vs desktop.

### Pattern 8: Orientation-Aware Breakpoints (Claude's Discretion)

The locked breakpoints are `<640px` = mobile, `640-1024px` = tablet, `>1024px` = desktop.

A landscape phone (e.g., iPhone 14 in landscape: 844px wide) would hit the 640px threshold and get the tablet layout. This is **correct behavior** — landscape phone benefits from the 3-column layout. No special orientation handling needed.

For portrait tablets with width 640-1024px, the scaled 3-column layout is appropriate.

**Recommendation: No `orientation` media query needed.** The width breakpoints are sufficient.

### Anti-Patterns to Avoid

- **JavaScript breakpoint hooks with SSR:** `useMediaQuery` + `window.matchMedia` causes React hydration mismatches in Next.js. The Dashboard is already `dynamic import` with `ssr: false`, so a mediaQuery hook would not cause hydration issues inside `Dashboard.tsx`. However, using CSS breakpoints is simpler, faster, and zero-JS overhead. Prefer CSS.

- **Canvas CSS scaling:** Applying `transform: scale(0.7)` to a canvas element visually scales it but the canvas still consumes its original layout space. Use `width`/`height` CSS properties to scale layout, but this causes blur on pixelated canvas. The CONTEXT decision (text fallback on mobile, canvas as-is on tablet) eliminates this problem entirely.

- **Canvas resize + redraw on breakpoint change:** Expensive. Canvas redraws happen on every telemetry packet at 4Hz. A ResizeObserver triggering redraws on breakpoint changes is fine but adds complexity. Since the CONTEXT decision uses text on mobile and fixed-size canvas on tablet/desktop, no resize logic is needed.

- **Hiding panels via `display: none` with canvas inside:** Canvas elements preserve their drawing buffer when hidden. No issue.

- **`touch-action: auto` on drag handles:** Without `touch-action: none` on the drag handle, iOS will intercept touches for scrolling and fire `pointercancel` instead of `pointermove`, breaking drag. The existing `setPointerCapture` handles mouse but `touch-action: none` is the reliable complement for touch.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Viewport meta `viewport-fit=cover` | Raw `<meta>` in `<head>` | `viewport` export in `layout.tsx` | Next.js App Router manages `<head>` — raw meta tags cause duplicate/conflicting tags |
| Safe area insets | Custom JS measurement | CSS `env(safe-area-inset-*)` + `@layer utilities` | Browser-native, zero JS, works in standalone PWA mode |
| Breakpoint JS detection | `window.matchMedia` hook | Tailwind v4 responsive prefixes (`sm:`, `lg:`) | No hydration risk, zero JS overhead, GPU-accelerated CSS transitions |
| Touch scroll prevention on drag | Custom touch event listeners | `touch-action: none` CSS property | Chrome passive event policy blocks `preventDefault()` in touch listeners by default |
| Per-breakpoint canvas sizing | `ResizeObserver` + canvas redraw | CONTEXT decision: text fallback on mobile | Simpler, no animation jank, maintains JARVIS aesthetic |

**Key insight:** The Tailwind breakpoint prefix system means zero JavaScript for layout switching. The browser handles everything via CSS, which is order-of-magnitude faster than JS-driven layout changes and immune to hydration mismatches.

---

## Common Pitfalls

### Pitfall 1: viewport export `viewportFit` not in the current `layout.tsx`

**What goes wrong:** `env(safe-area-inset-bottom)` returns `0px` on all devices because without `viewport-fit=cover`, the browser clips the page to the safe area automatically and does not expose non-zero inset values.

**Why it happens:** The existing `layout.tsx` `viewport` export only has `themeColor`. On notched iPhones in standalone PWA mode, the home indicator area (34px) is clipped — content is safe but the bottom bar floats above an ugly black strip.

**How to avoid:** Add `viewportFit: 'cover'` and `width: 'device-width'` to the `viewport` export. Then add `safe-pb` class to the bottom bar.

**Warning signs:** White/black strip below the bottom bar on iPhone in PWA standalone mode.

### Pitfall 2: iOS Safari `pointercancel` during drag on touch devices

**What goes wrong:** Touch drag works for 1-2 pixels then stops. The element snaps back to its original position.

**Why it happens:** iOS Safari fires `pointercancel` when it detects a scroll gesture, canceling the pointer capture. `setPointerCapture` alone does not override this on iOS when `touch-action` is not set.

**How to avoid:** Add `style={{ touchAction: editMode ? 'none' : 'auto' }}` to `DraggablePanel`. Since drag is only active in edit mode, this limits the `touch-action: none` impact to when it is actually needed.

**Warning signs:** Drag works on desktop but stops immediately or snaps back on phone/tablet.

### Pitfall 3: Stale `editMode: true` state on mobile

**What goes wrong:** User opens app on desktop in edit mode, resizes to mobile, the edit mode toolbar is hidden via CSS but `editMode` is still `true` in state. Panels may still show the `panel-edit-mode` CSS border (from `DraggablePanel`).

**Why it happens:** React state does not reset on viewport resize.

**How to avoid:** Either:
- (a) Force `editMode` off when viewport crosses below 640px (requires a matchMedia listener in useEffect)
- (b) Don't render `panel-edit-mode` class or drag handlers when a `isDesktop` prop is false
- (c) Accept that edit mode borders render but drag does not work — minor cosmetic issue, not functional

**Recommended:** Option (a) with a simple `useEffect` + `window.matchMedia` listener:

```ts
// In Dashboard.tsx — clear editMode when dropping below sm breakpoint
useEffect(() => {
  const mq = window.matchMedia('(min-width: 640px)')
  const handler = (e: MediaQueryListEvent) => {
    if (!e.matches) setEditMode(false)
  }
  mq.addEventListener('change', handler)
  return () => mq.removeEventListener('change', handler)
}, [])
```

This is a **one-time listener registration** (useEffect), not a polling hook. It only fires on breakpoint crossing. No SSR risk because Dashboard is `ssr: false`.

### Pitfall 4: Bottom bar obscuring content on iPhone landscape

**What goes wrong:** In landscape orientation on iPhone, the bottom bar's fixed 50px height plus `env(safe-area-inset-bottom)` (which is 0px in landscape but the phone's home indicator area shrinks) may overlap the last panel.

**Why it happens:** The dashboard uses `h-screen flex flex-col` — the bottom bar consumes its fixed height from the flex flow. Safe area handling is correct but the available height for the main content area is reduced.

**How to avoid:** The existing `flex-1 min-h-0` on the main content area correctly contracts when the bars take space. No additional handling needed — the panels use `overflow-hidden` and will just show less content vertically, which is acceptable.

### Pitfall 5: Canvas `width`/`height` attributes vs CSS `width`/`height`

**What goes wrong:** Adding Tailwind `w-full` to a canvas stretches the display without changing the internal buffer, causing blurry stretched rendering.

**Why it happens:** HTML canvas `width`/`height` attributes set the buffer resolution; CSS size scales the display. Mismatch = blur.

**How to avoid:** Do NOT apply CSS sizing to canvas elements. The CONTEXT decision (text fallback on mobile, canvas as-is on tablet/desktop) makes this a non-issue. The canvas components render `hidden sm:block` on mobile with the text fallback `sm:hidden`, and at `sm:` breakpoints the canvas renders at its hardcoded pixel dimensions.

### Pitfall 6: `overflow: hidden` on body preventing safe-area content

**What goes wrong:** `globals.css` has `overflow: hidden` on `body`. Safe area insets add padding to the outer bars, but if the main dashboard container also clips, the safe area padding may not be visible.

**Why it happens:** The `h-screen flex flex-col` pattern inside a `overflow: hidden` body means the bars get padded outward but within the body, not beyond it.

**How to avoid:** This is actually correct — `overflow: hidden` prevents page scroll (intentional for a fullscreen HUD). The safe area padding increases the `h-[52px]` top bar height by `env(safe-area-inset-top)`, which is consumed within the flex flow. No issue.

### Pitfall 7: CollapsibleWidget localStorage reads on first render (SSR)

**What goes wrong:** `CollapsibleWidget` reads localStorage in its state initializer: `if (typeof window === 'undefined') return true`. On SSR, this always returns `true` (expanded). Adding `defaultOpen={false}` for mobile requires the SSR-rendered HTML to match the client value, which it won't if `defaultOpen` differs from the SSR fallback.

**Why it happens:** The dashboard is loaded with `dynamic(() => import(...), { ssr: false })`, so this component never renders on the server. The SSR guard is there for type safety only. No hydration mismatch risk.

**How to avoid:** Since the Dashboard is client-only, implement the `defaultOpen` prop normally — it will only ever run in the browser.

---

## Code Examples

### Viewport export with viewportFit (Next.js App Router)

```ts
// Source: https://nextjs.org/docs/app/api-reference/functions/generate-viewport
// apps/web/src/app/layout.tsx
import type { Metadata, Viewport } from 'next'

export const viewport: Viewport = {
  themeColor: '#010a1a',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}
// Generates: <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
```

### Safe area CSS utilities (Tailwind v4)

```css
/* Source: MDN env() + Tailwind v4 @layer pattern */
/* apps/web/src/app/globals.css — add after existing utilities */
@layer utilities {
  .safe-pt { padding-top: env(safe-area-inset-top, 0px); }
  .safe-pb { padding-bottom: env(safe-area-inset-bottom, 0px); }
  .safe-pl { padding-left: env(safe-area-inset-left, 0px); }
  .safe-pr { padding-right: env(safe-area-inset-right, 0px); }
}
```

### Tailwind v4 custom breakpoints (if needed)

```css
/* Source: https://tailwindcss.com/docs/responsive-design */
/* Tailwind v4 default breakpoints already match the spec:
   sm = 640px (mobile boundary), lg = 1024px (desktop boundary)
   No custom breakpoints needed for Phase 13 */
@theme inline {
  /* existing theme variables ... */
  /* sm and lg are built-in, no additions needed */
}
```

### SSR-safe breakpoint listener in useEffect (for stale editMode fix)

```ts
// Source: MDN MediaQueryList addEventListener pattern
// In Dashboard.tsx
useEffect(() => {
  const mq = window.matchMedia('(min-width: 640px)')
  const handleChange = (e: MediaQueryListEvent) => {
    if (!e.matches) setEditMode(false)  // Exiting tablet/desktop — clear drag mode
  }
  mq.addEventListener('change', handleChange)
  return () => mq.removeEventListener('change', handleChange)
}, [])
// Safe: Dashboard is already `ssr: false` — this only runs in browser
```

### touch-action on drag handle

```tsx
// Source: MDN touch-action + pointer events spec
// apps/web/src/components/draggable-panel.tsx
<div
  ref={elRef}
  data-panel-id={panelId}
  className={`${editMode ? 'panel-edit-mode' : ''} ${className}`}
  style={{
    transform: `translate(${offset.dx}px, ${offset.dy}px)`,
    position: 'relative',
    zIndex: editMode ? 10 : undefined,
    touchAction: editMode ? 'none' : 'auto',  // Prevents iOS pointercancel during drag
  }}
  onPointerDown={onPointerDown}
  onPointerMove={onPointerMove}
  onPointerUp={onPointerUp}
>
  {children}
</div>
```

### Compact mobile top bar pattern (Tailwind v4)

```tsx
// Source: Tailwind v4 responsive prefix docs
// Hides sub-title, reduces height, hides LAYOUT button at mobile
<div className="... h-[44px] sm:h-[52px] px-3 sm:px-6 safe-pt safe-pl safe-pr">
  <div>
    <div className="text-[12px] sm:text-[14px] font-bold glow-text" style={{ letterSpacing: '4px' }}>
      J·A·R·V·I·S
    </div>
    <div className="hidden sm:block text-[12px] opacity-50" style={{ letterSpacing: '2px' }}>
      TACTICAL HUD v2.0
    </div>
  </div>
  {/* nav links: hidden sm:flex */}
  {/* LAYOUT button: hidden sm:inline-flex */}
</div>
```

### Canvas text fallback for mobile

```tsx
// Source: CONTEXT.md decision — compact HUD readout aesthetic
// In ADI component
<>
  {/* Canvas instrument — visible at sm and above */}
  <canvas
    ref={canvasRef}
    width={180}
    height={180}
    className="hidden sm:block"
    style={{ imageRendering: 'pixelated' }}
  />
  {/* Text fallback — visible only on mobile */}
  <div className="sm:hidden py-1 text-center">
    <div className="text-[10px] opacity-50 tracking-widest mb-0.5">ATT</div>
    <div className="text-xl font-bold text-jarvis-accent tabular-nums" style={{ letterSpacing: '2px' }}>
      P {pitchDeg >= 0 ? '+' : ''}{pitchDeg}° / B {bankDeg >= 0 ? 'R' : 'L'}{Math.abs(bankDeg)}°
    </div>
  </div>
</>
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `tailwind.config.js` breakpoints | `@theme` CSS breakpoints | Tailwind v4 | No config file needed, inline CSS theme |
| `window.matchMedia` hook for responsive JS | CSS media queries only | React 18+ hydration strictness | Eliminates hydration mismatch class of bugs |
| `viewport-fit=cover` in `<meta>` raw HTML | `viewport` export (`Viewport` type) | Next.js 14+ App Router | Proper `<head>` management, no duplicates |
| `touch-action: none` via JS | CSS property | Chrome 56+ passive listeners | `preventDefault()` in touch handlers blocked by default |
| Container queries (external lib) | Tailwind v4 built-in `@container` | Tailwind v4 | No extra package; component-level breakpoints if needed |

**Not needed / deprecated for this phase:**
- `react-responsive` / `react-breakpoints`: External libraries with SSR complexity — avoid.
- `tailwindcss-safe-area` plugin: The manual `@layer utilities` approach with `env()` is equivalent and requires zero new packages.
- Grid-template-columns `minmax()` auto-fill: Not applicable — the layout uses fixed column widths by design.

---

## Open Questions

1. **Tablet drag: separate storage key or shared with desktop?**
   - What we know: Tablet uses `640-1024px` width, same 3-column grid structure, but narrower (Tailwind's `sm:` preset of 240px left + 1fr + 200px or desktop's 280px right column).
   - What's unclear: Whether the user needs distinct drag positions per breakpoint or if desktop positions "mostly work" on tablet.
   - Recommendation: Use separate keys (`jarvis-panel-positions-tablet-v1` vs `jarvis-panel-positions-desktop-v1`) for cleanliness. The hook already computes `getStorageKey()` once per mount — load/save correctly.

2. **Bottom bar on mobile: show or hide?**
   - What we know: Bottom bar shows LAT/LON/AGL, uptime ticker, and status. These are secondary on mobile.
   - What's unclear: Whether to show a compact version or hide it entirely to maximize instrument space.
   - Recommendation: Hide entirely on mobile (`hidden sm:flex`). The top bar connection pill already shows status. Screen real estate on phone is precious.

3. **Mini telemetry strip on mobile: sticky header or inline?**
   - What we know: CONTEXT says "mini telemetry cards pinned/sticky at top on mobile — rendered as simple text + values."
   - What's unclear: Whether "pinned" means CSS `position: sticky` within the scroll area or `position: fixed` overlay.
   - Recommendation: Use `position: sticky; top: 0` within the single-column scroll container. This keeps the telemetry values visible while the user scrolls through collapsed panels, without the complexity of a fixed overlay.

4. **Scroll behavior on mobile: `overflow-y: auto` on main content or full page scroll?**
   - What we know: `body` has `overflow: hidden`. The dashboard uses `h-screen flex flex-col` with `flex-1 min-h-0` on the main content area.
   - What's unclear: On mobile, panels stack vertically and may overflow the screen. If the main content area is `overflow: hidden`, panels below the fold are cut off.
   - Recommendation: On mobile, the main content area (currently `overflow-hidden`) needs `overflow-y: auto` to allow scrolling through the stacked panels. Apply `sm:overflow-hidden` to restore the current behavior on tablet and desktop.

---

## Sources

### Primary (HIGH confidence)
- Tailwind CSS v4 docs, responsive-design — default breakpoints, `@theme` custom breakpoints, arbitrary breakpoints, container queries
- Next.js 16.1.6 docs, `generate-viewport` — `Viewport` type with `viewportFit: 'cover'`, `width`, `initialScale`
- MDN `env()` documentation — `safe-area-inset-*` environment variables
- WebKit/Apple blog (Designing for iPhone X) — `viewport-fit=cover` required for non-zero safe-area values
- Codebase direct read: `dashboard.tsx`, `draggable-panel.tsx`, `use-panel-positions.ts`, `globals.css`, `layout.tsx`, all instruments

### Secondary (MEDIUM confidence)
- MDN `touch-action` — `touch-action: none` required for reliable pointer capture on iOS Safari
- Chrome developer blog — passive touch event listeners default since Chrome 56; `touch-action: none` is the CSS alternative to `{ passive: false }` workaround
- WebSearch (multiple sources agreeing) — `window.matchMedia` in React causes SSR hydration mismatches; CSS breakpoints preferred

### Tertiary (LOW confidence — flagged for validation)
- Instrument canvas sizing behavior on iPad: The research assumes tablet (640-1024px) can display 180x180 ADI and 120x220 G-meter at their native dimensions within the scaled 3-column grid. This needs visual verification during implementation.

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — project uses Tailwind v4 (verified version 4.2.1), no new packages needed
- Viewport / safe area: HIGH — Next.js Viewport API verified from official docs; env() from MDN
- Architecture patterns: HIGH — derived from direct codebase read of all relevant files
- Touch drag behavior: HIGH — touch-action spec and pointer events spec are web standards
- Canvas mobile fallback: HIGH — CONTEXT.md decision is explicit; implementation pattern is straightforward
- Breakpoint storage key strategy: MEDIUM — logical reasoning, not a web standard
- Mobile scroll behavior: MEDIUM — inferred from `overflow: hidden` on body; needs visual QA

**Research date:** 2026-03-15
**Valid until:** 2026-04-15 (Tailwind v4 and Next.js 16 are stable; CSS env() is a web standard)
