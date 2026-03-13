# Requirements: v2.0 — PWA + Responsive Layout + UI Amendments

**Milestone:** v2.0
**Created:** 2026-03-04
**Updated:** 2026-03-13 — Added REQ-228 to REQ-248 (UI Amendments)
**Status:** Active

---

## PWA Core

- [x] **REQ-200** — Web app manifest (`app/manifest.ts`) with JARVIS branding: name, short_name, description, start_url, display: standalone, theme_color (#010a1a), background_color (#010a1a)
- [x] **REQ-201** — PWA icons: 192x192, 512x512, maskable 512x512 (JARVIS-branded)
- [x] **REQ-202** — Apple touch icon (180x180) and iOS meta tags (apple-mobile-web-app-capable, status-bar-style)
- [x] **REQ-203** — Service worker registers on app load with `updateViaCache: 'none'`
- [x] **REQ-204** — Service worker caches app shell (HTML, CSS, JS bundles) for instant load
- [x] **REQ-205** — Cache-first strategy for immutable static assets (`/_next/static/`)
- [x] **REQ-206** — Network-first strategy for HTML navigation with offline fallback
- [x] **REQ-207** — Network-only for Supabase endpoints, API routes, auth endpoints, RSC payloads
- [x] **REQ-208** — Offline fallback page (`offline.html`) with JARVIS theme styling
- [x] **REQ-209** — Service worker update detection with "New version available" banner (prompt-to-refresh, NOT auto-reload)
- [x] **REQ-210** — `Cache-Control: no-cache, no-store, must-revalidate` header for `sw.js`

## Install Experience

- [x] **REQ-211** — Custom install prompt UI using `beforeinstallprompt` event (Chromium browsers)
- [x] **REQ-212** — iOS install guidance (manual "Add to Home Screen" instructions when iOS detected)
- [x] **REQ-213** — Install state detection (`display-mode: standalone` media query) — hide install prompt when already installed
- [x] **REQ-214** — App launches in standalone window (no browser chrome) on desktop and mobile

## Font Size Overhaul (Amendment 2)

- [ ] **REQ-228** — Primary telemetry values (IAS, ALT, HDG, Mach, TAS) at minimum 36px font size
- [ ] **REQ-229** — Canvas instrument values at increased sizes: G-meter 56px, VVI 48px, RPM 42px
- [ ] **REQ-230** — Secondary labels (section headers 14-15px, unit labels 13-14px, sub-labels 12-13px, coaching/status text 13-14px)
- [ ] **REQ-231** — Font conventions preserved throughout: tabular-nums, Courier New monospace, letter-spacing, line-height adjusted for new sizes

## Smart Connection Status (Amendment 3 + 4a + 4c)

- [ ] **REQ-232** — ConnectionStatusPanel component with 4 states: INITIALIZING (amber pulsing) → SYSTEM INITIALIZED (cyan static) → DCS ONLINE (green solid) → DCS OFFLINE (red pulsing), replacing SessionPanel
- [ ] **REQ-233** — DEV MODE button relocated from primary UI to CompactDebug strip as subtle [DEV] toggle
- [ ] **REQ-234** — Top bar connection pill updated with state-aware labels/colors: INITIALIZING (amber) / STANDBY (cyan) / ONLINE (green) / OFFLINE (red)
- [ ] **REQ-235** — Coaching strip state-aware text: no session → "CREATE SESSION TO BEGIN", session but not connected → "AWAITING DCS LAUNCH", connected → live coaching data
- [ ] **REQ-236** — Pairing code UI retained in ConnectionStatusPanel when session exists and bridge is unclaimed

## Collapsible Widgets (Amendment 4d)

- [ ] **REQ-237** — CollapsibleWidget wrapper component with title bar toggle (click to collapse/expand body)
- [ ] **REQ-238** — Chevron indicator: ▾ when open, ▸ when collapsed, matching panel-title styling
- [ ] **REQ-239** — Collapsed state shows title bar only (body hidden), collapsed height matches standard panel-title height
- [ ] **REQ-240** — Non-collapsible components excluded: ConnectionStatusPanel, MiniTelemetryCards, coaching strip, debug strip

## Draggable Layout (Amendment 1)

- [ ] **REQ-241** — react-grid-layout dependency installed and configured for Next.js 16 / React 19
- [ ] **REQ-242** — useWidgetLayout hook with localStorage persistence (key: jarvis-widget-layout-v1) and SSR safety (typeof window check)
- [ ] **REQ-243** — Edit mode toggle button in top bar with cyan glow when active; layout locked and clean when inactive
- [ ] **REQ-244** — ResponsiveGridLayout with 12-column grid, default positions matching current 3-column layout (left: x:0 w:2, center: x:2 w:8, right: x:10 w:2)
- [ ] **REQ-245** — Edit mode visual indicators: glowing border (1px solid rgba(0,255,255,0.4)) on widgets, drag handles (⠿) on hover
- [ ] **REQ-246** — preventCollision={true} and compactType={null} for free positioning without auto-compaction
- [ ] **REQ-247** — Reset Layout button to clear localStorage and restore default positions
- [ ] **REQ-248** — Mobile fallback at <768px viewport: stacked column layout, no drag-and-drop

## Offline Experience

- [ ] **REQ-215** — Online/offline status detection hook (`useOnlineStatus`)
- [ ] **REQ-216** — Offline overlay with "CONNECTION LOST" message and auto-reconnect indication
- [ ] **REQ-217** — Dashboard shell renders offline (panels, layout, JARVIS theme) — data areas show "waiting for connection" state

## Responsive Layout

- [ ] **REQ-218** — Breakpoint system: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- [ ] **REQ-219** — Mobile layout: single-column stack of key instruments (IAS, ALT, HDG, engine status)
- [ ] **REQ-220** — Tablet layout: 2-column grid with instruments and tactical/status panels
- [ ] **REQ-221** — Desktop layout: existing 3-column grid preserved (260px | 1fr | 280px) or react-grid-layout equivalent
- [ ] **REQ-222** — Touch-friendly controls: minimum 44px tap targets, appropriate spacing
- [ ] **REQ-223** — Safe area insets for notched devices (`env(safe-area-inset-*)`)
- [ ] **REQ-224** — Viewport meta tag with `viewport-fit=cover` for edge-to-edge rendering

## Quality & Polish

- [ ] **REQ-225** — Lighthouse PWA-adjacent checks pass (manifest, SW, HTTPS, viewport, theme-color)
- [ ] **REQ-226** — No regressions on desktop dashboard layout or functionality
- [ ] **REQ-227** — Service worker does NOT interfere with Supabase Realtime WebSocket connections

---

## Out of Scope (v2.0)

- Push notifications (web-push, VAPID)
- Background sync
- Offline data storage (IndexedDB for telemetry)
- Training events / scoring / coaching
- DCS injection / audio cues
- Window Controls Overlay (desktop advanced title bar)

---

## Traceability

| REQ-ID | Category | Phase | Status |
|--------|----------|-------|--------|
| REQ-200 | PWA Core | 8 | Complete |
| REQ-201 | PWA Core | 8 | Complete |
| REQ-202 | PWA Core | 8 | Complete |
| REQ-203 | PWA Core | 8 | Complete |
| REQ-204 | PWA Core | 8 | Complete |
| REQ-205 | PWA Core | 8 | Complete |
| REQ-206 | PWA Core | 8 | Complete |
| REQ-207 | PWA Core | 8 | Complete |
| REQ-208 | PWA Core | 8 | Complete |
| REQ-209 | PWA Core | 8 | Complete |
| REQ-210 | PWA Core | 8 | Complete |
| REQ-211 | Install Experience | 8 | Complete |
| REQ-212 | Install Experience | 8 | Complete |
| REQ-213 | Install Experience | 8 | Complete |
| REQ-214 | Install Experience | 8 | Complete |
| REQ-228 | Font Size Overhaul | 9 | Pending |
| REQ-229 | Font Size Overhaul | 9 | Pending |
| REQ-230 | Font Size Overhaul | 9 | Pending |
| REQ-231 | Font Size Overhaul | 9 | Pending |
| REQ-232 | Smart Connection Status | 10 | Pending |
| REQ-233 | Smart Connection Status | 10 | Pending |
| REQ-234 | Smart Connection Status | 10 | Pending |
| REQ-235 | Smart Connection Status | 10 | Pending |
| REQ-236 | Smart Connection Status | 10 | Pending |
| REQ-237 | Collapsible Widgets | 11 | Pending |
| REQ-238 | Collapsible Widgets | 11 | Pending |
| REQ-239 | Collapsible Widgets | 11 | Pending |
| REQ-240 | Collapsible Widgets | 11 | Pending |
| REQ-241 | Draggable Layout | 12 | Pending |
| REQ-242 | Draggable Layout | 12 | Pending |
| REQ-243 | Draggable Layout | 12 | Pending |
| REQ-244 | Draggable Layout | 12 | Pending |
| REQ-245 | Draggable Layout | 12 | Pending |
| REQ-246 | Draggable Layout | 12 | Pending |
| REQ-247 | Draggable Layout | 12 | Pending |
| REQ-248 | Draggable Layout | 12 | Pending |
| REQ-218 | Responsive Layout | 13 | Pending |
| REQ-219 | Responsive Layout | 13 | Pending |
| REQ-220 | Responsive Layout | 13 | Pending |
| REQ-221 | Responsive Layout | 13 | Pending |
| REQ-222 | Responsive Layout | 13 | Pending |
| REQ-223 | Responsive Layout | 13 | Pending |
| REQ-224 | Responsive Layout | 13 | Pending |
| REQ-215 | Offline Experience | 14 | Pending |
| REQ-216 | Offline Experience | 14 | Pending |
| REQ-217 | Offline Experience | 14 | Pending |
| REQ-225 | Quality & Polish | 14 | Pending |
| REQ-226 | Quality & Polish | 14 | Pending |
| REQ-227 | Quality & Polish | 14 | Pending |
