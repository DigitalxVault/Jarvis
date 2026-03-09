# Roadmap: JARVIS DCS

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1-7 (shipped 2026-02-25) -- [archive](milestones/v1.0-ROADMAP.md)
- ACTIVE **v2.0 PWA + Responsive Layout** -- Phases 8-10

## Phases

<details>
<summary>v1.0 MVP (Phases 1-7) -- SHIPPED 2026-02-25</summary>

- [x] Phase 1: Shared Foundation (3/3 plans) -- completed 2026-02-25
- [x] Phase 2: Bridge Core (3/3 plans) -- completed 2026-02-25
- [x] Phase 3: DCS Export.lua (2/2 plans) -- completed 2026-02-25
- [x] Phase 4: Web UI Foundation (3/3 plans) -- completed 2026-02-25
- [x] Phase 5: Session Pairing (2/2 plans) -- completed 2026-02-25
- [x] Phase 6: Telemetry UI (3/3 plans) -- completed 2026-02-25
- [x] Phase 7: Resilience and Stability (2/2 plans) -- completed 2026-02-25

</details>

### v2.0 PWA + Responsive Layout

---

#### Phase 8: PWA Foundation

**Goal:** App is installable on desktop and mobile with proper caching -- users can add JARVIS to their home screen and the app shell loads instantly on repeat visits.

**Dependencies:** v1.0 shipped (Next.js app, Supabase integration, dashboard UI all working)

**Plans:** 4 plans

Plans:
- [x] 08-01-PLAN.md -- Manifest, icons, and layout PWA metadata
- [x] 08-02-PLAN.md -- Service worker with cache routing and registration
- [x] 08-03-PLAN.md -- Offline fallback page and SW update banner
- [x] 08-04-PLAN.md -- Install prompt (Chromium + iOS)

**Requirements:**
- REQ-200 -- Web app manifest with JARVIS branding
- REQ-201 -- PWA icons (192x192, 512x512, maskable)
- REQ-202 -- Apple touch icon and iOS meta tags
- REQ-203 -- Service worker registration on app load
- REQ-204 -- App shell caching (HTML, CSS, JS bundles)
- REQ-205 -- Cache-first for immutable static assets
- REQ-206 -- Network-first for HTML navigation with offline fallback
- REQ-207 -- Network-only for Supabase, API routes, auth, RSC payloads
- REQ-208 -- Offline fallback page with JARVIS theme
- REQ-209 -- SW update detection with prompt-to-refresh banner
- REQ-210 -- Cache-Control headers for sw.js
- REQ-211 -- Custom install prompt (Chromium beforeinstallprompt)
- REQ-212 -- iOS install guidance (manual Add to Home Screen)
- REQ-213 -- Install state detection (hide prompt when installed)
- REQ-214 -- Standalone launch (no browser chrome)

**Success Criteria:**
1. User can install JARVIS from Chrome/Edge on desktop and the app opens in a standalone window with no browser chrome
2. User can install JARVIS on Android via custom install banner and on iOS via guided "Add to Home Screen" instructions
3. Return visits load the app shell instantly (cache-first static assets) while HTML fetches fresh from network
4. When a new version deploys, user sees a "New version available" banner and can refresh on their own terms -- never auto-reloaded mid-flight
5. Supabase Realtime, API routes, and RSC payloads are never cached by the service worker

---

#### Phase 9: Responsive Layout

**Goal:** Dashboard renders correctly on phones, tablets, and desktops -- pilots can glance at key instruments on a phone mounted in their cockpit or use the full dashboard on a monitor.

**Dependencies:** Phase 8 (PWA foundation must be in place so responsive layout is tested in standalone mode)

**Plans:** 4 plans

Plans:
- [ ] 09-01-PLAN.md -- Viewport, breakpoints, and safe area foundation
- [ ] 09-02-PLAN.md -- Responsive dashboard grid
- [ ] 09-03-PLAN.md -- Responsive canvas instruments
- [ ] 09-04-PLAN.md -- Touch UX and polish

**Requirements:**
- REQ-218 -- Breakpoint system: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- REQ-219 -- Mobile layout: single-column stack of key instruments
- REQ-220 -- Tablet layout: 2-column grid
- REQ-221 -- Desktop layout: existing 3-column grid preserved
- REQ-222 -- Touch-friendly controls (44px minimum tap targets)
- REQ-223 -- Safe area insets for notched devices
- REQ-224 -- Viewport meta tag with viewport-fit=cover

**Success Criteria:**
1. On a phone (<640px), dashboard displays a single-column stack of key instruments (IAS, ALT, HDG, engine) with no horizontal scrolling
2. On a tablet (640-1024px), dashboard displays a 2-column grid with instruments and tactical panels
3. On desktop (>1024px), existing 3-column layout is preserved exactly as shipped in v1.0
4. All interactive elements meet 44px minimum tap target size on touch devices
5. Content renders correctly on notched devices (iPhone, Android) with no overlap into system UI areas

---

#### Phase 10: Offline Shell & Polish

**Goal:** The app degrades gracefully when network drops and passes Lighthouse PWA checks -- users see a clear "CONNECTION LOST" state instead of a broken page, and the overall PWA implementation meets quality standards.

**Dependencies:** Phase 8 (service worker), Phase 9 (responsive layout for offline overlay rendering)

**Requirements:**
- REQ-215 -- Online/offline status detection hook (useOnlineStatus)
- REQ-216 -- Offline overlay with "CONNECTION LOST" message and auto-reconnect indication
- REQ-217 -- Dashboard shell renders offline with "waiting for connection" state
- REQ-225 -- Lighthouse PWA-adjacent checks pass
- REQ-226 -- No regressions on desktop dashboard layout or functionality
- REQ-227 -- Service worker does NOT interfere with Supabase Realtime WebSocket

**Success Criteria:**
1. When network drops, user sees a "CONNECTION LOST" overlay within 3 seconds with an auto-reconnect indicator -- no white screen or browser error
2. The dashboard shell (panels, layout, JARVIS theme) renders fully offline with data areas showing "waiting for connection"
3. When network returns, the overlay disappears and telemetry resumes without manual page refresh
4. Lighthouse audit scores green on all PWA-adjacent checks (manifest, service worker, HTTPS, viewport, theme-color)
5. All v1.0 desktop dashboard functionality works identically after v2.0 changes -- no regressions in telemetry display, alerts, or session pairing

---

## Progress

| Phase | Milestone | Plans Complete | Status | Completed |
|-------|-----------|----------------|--------|-----------|
| 1. Shared Foundation | v1.0 | 3/3 | Complete | 2026-02-25 |
| 2. Bridge Core | v1.0 | 3/3 | Complete | 2026-02-25 |
| 3. DCS Export.lua | v1.0 | 2/2 | Complete | 2026-02-25 |
| 4. Web UI Foundation | v1.0 | 3/3 | Complete | 2026-02-25 |
| 5. Session Pairing | v1.0 | 2/2 | Complete | 2026-02-25 |
| 6. Telemetry UI | v1.0 | 3/3 | Complete | 2026-02-25 |
| 7. Resilience and Stability | v1.0 | 2/2 | Complete | 2026-02-25 |
| 8. PWA Foundation | v2.0 | 4/4 | Complete | 2026-03-04 |
| 9. Responsive Layout | v2.0 | 0/4 | Planned | -- |
| 10. Offline Shell & Polish | v2.0 | 0/? | Not Started | -- |

---
*Roadmap created: 2026-02-25*
*Last updated: 2026-03-04 -- Phase 9 planned (4 plans in 2 waves)*
