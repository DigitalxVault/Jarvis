# Roadmap: JARVIS DCS

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1-7 (shipped 2026-02-25) -- [archive](milestones/v1.0-ROADMAP.md)
- ACTIVE **v2.0 PWA + Responsive Layout + UI Amendments** -- Phases 8-14

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

### v2.0 PWA + Responsive Layout + UI Amendments

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
- REQ-200 through REQ-214 (all complete)

**Success Criteria:**
1. User can install JARVIS from Chrome/Edge on desktop and the app opens in a standalone window with no browser chrome
2. User can install JARVIS on Android via custom install banner and on iOS via guided "Add to Home Screen" instructions
3. Return visits load the app shell instantly (cache-first static assets) while HTML fetches fresh from network
4. When a new version deploys, user sees a "New version available" banner and can refresh on their own terms -- never auto-reloaded mid-flight
5. Supabase Realtime, API routes, and RSC payloads are never cached by the service worker

---

#### Phase 9: Font Size Overhaul (Amendment 2)

**Goal:** All telemetry values and labels are large enough for a pilot to read at a glance while flying DCS -- primary values at 36-64px, secondary labels at 12-15px.

**Dependencies:** Phase 8 (PWA foundation complete; pure visual changes, safest to apply first)

**Plans:** 2 plans

Plans:
- [ ] 09-01-PLAN.md -- DOM component font sizes (mini-telemetry-cards, fuel-gauge, aoa-indicator, coaching/debug strips, bottom-bar)
- [ ] 09-02-PLAN.md -- Canvas instrument font sizes (engine-panel, g-meter, vvi-tape) with Y-offset recalculation

**Requirements:**
- REQ-228 -- Primary telemetry values at minimum 36px
- REQ-229 -- Canvas instrument values (G-meter 56px, VVI 48px, RPM 42px)
- REQ-230 -- Secondary labels at 12-15px range
- REQ-231 -- Font conventions preserved (tabular-nums, Courier New, letter-spacing)

**Success Criteria:**
1. Primary telemetry values (IAS, ALT, HDG, Mach, TAS) render at 36px+ and are readable at arm's length
2. Canvas instruments (G-meter, VVI, RPM) display values at specified increased sizes with correct positioning
3. All secondary labels, unit text, and coaching/debug strips use increased font sizes per Amendment 2 spec
4. Font styling conventions (tabular-nums, Courier New, letter-spacing, uppercase) are preserved throughout
5. `pnpm typecheck` passes clean after all changes

---

#### Phase 10: Smart Connection Status (Amendment 3 + 4a + 4c)

**Goal:** Replace the confusing START SESSION / DEV MODE buttons with a smart, animated 4-state connection status display that automatically progresses through connection states.

**Dependencies:** Phase 9 (font sizes applied; status panel uses the new font size conventions)

**Plans:** 2 plans

Plans:
- [ ] 10-01-PLAN.md -- ConnectionStatusPanel component (replaces SessionPanel) with 4-state machine
- [ ] 10-02-PLAN.md -- Top bar connection pill update (4a) + coaching strip state text (4c) + DEV MODE relocation to CompactDebug (3)

**Requirements:**
- REQ-232 -- ConnectionStatusPanel with 4 states (INITIALIZING → SYSTEM INITIALIZED → DCS ONLINE → DCS OFFLINE)
- REQ-233 -- DEV MODE relocated to CompactDebug strip
- REQ-234 -- Top bar connection pill with state-aware labels/colors
- REQ-235 -- Coaching strip state-aware text (3 states)
- REQ-236 -- Pairing code UI retained when applicable

**Success Criteria:**
1. ConnectionStatusPanel shows correct state based on connection lifecycle (no session → session created → telemetry flowing → connection lost)
2. Status dot, title, and sub-text match the Amendment 3 visual spec for each state
3. Top bar pill reflects connection state with correct labels and colors per Amendment 4a
4. Coaching strip shows "AWAITING DCS LAUNCH" when session exists but DCS not connected
5. DEV MODE is accessible via CompactDebug strip, no longer visible in primary UI
6. `pnpm typecheck` passes clean

---

#### Phase 11: Collapsible Widgets (Amendment 4d)

**Goal:** Instrument panels can be collapsed to just their title bar, letting pilots declutter the screen and making panels easier to reposition in future drag mode.

**Dependencies:** Phase 10 (connection status panel finalized; defines which components are non-collapsible)

**Plans:** 1 plan

Plans:
- [ ] 11-01-PLAN.md -- CollapsibleWidget component + wrap instrument panels (Fuel, Engine, G-Meter, AoA, VVI)

**Requirements:**
- REQ-237 -- CollapsibleWidget wrapper component with title bar toggle
- REQ-238 -- Chevron indicator (▾ open / ▸ closed)
- REQ-239 -- Collapsed state shows title bar only
- REQ-240 -- Non-collapsible components excluded (ConnectionStatusPanel, MiniTelemetryCards, coaching, debug)

**Success Criteria:**
1. Clicking a widget title bar (FUEL, ENGINE, G-METER, ANGLE OF ATTACK, VERTICAL SPEED) toggles collapse/expand
2. Collapsed state shows only the title bar with ▸ chevron; expanded shows ▾ with full content
3. ConnectionStatusPanel, top center telemetry cards, coaching strip, and debug strip are NOT collapsible
4. `pnpm typecheck` passes clean

---

#### Phase 12: Draggable Layout (Amendment 1)

**Goal:** Every telemetry widget is individually draggable and freely positionable using react-grid-layout, with localStorage persistence, edit mode toggle, and mobile fallback.

**Dependencies:** Phase 11 (collapsible widgets provide the wrapper components that become grid items)

**Plans:** 3 plans

Plans:
- [ ] 12-01-PLAN.md -- Install react-grid-layout, create useWidgetLayout hook with localStorage persistence
- [ ] 12-02-PLAN.md -- Edit mode toggle in top bar + refactor dashboard.tsx to use ResponsiveGridLayout
- [ ] 12-03-PLAN.md -- Visual polish (glow borders, drag handles, Reset Layout button, mobile fallback)

**Requirements:**
- REQ-241 -- react-grid-layout dependency
- REQ-242 -- useWidgetLayout hook with localStorage persistence + SSR safety
- REQ-243 -- Edit mode toggle in top bar (cyan glow when active)
- REQ-244 -- ResponsiveGridLayout with 12-column grid, default positions match current layout
- REQ-245 -- Edit mode visual indicators (glow borders, drag handles)
- REQ-246 -- preventCollision + compactType=null (free positioning)
- REQ-247 -- Reset Layout button
- REQ-248 -- Mobile fallback at <768px (stacked, no drag)

**Success Criteria:**
1. In edit mode, all panels are draggable and droppable with visible drag handles and glow borders
2. Layout persists to localStorage and survives page refresh
3. Reset Layout button restores default positions
4. Widgets do not overlap (preventCollision enabled)
5. Below 768px viewport, layout falls back to stacked column (no react-grid-layout)
6. `pnpm typecheck` and `pnpm --filter @jarvis-dcs/web lint` pass clean

---

#### Phase 13: Responsive Layout (rewritten for react-grid-layout)

**Goal:** Dashboard renders correctly on phones, tablets, and desktops -- pilots can glance at key instruments on a phone mounted in their cockpit or use the full dashboard on a monitor.

**Dependencies:** Phase 12 (draggable layout with react-grid-layout establishes the grid system that responsive breakpoints build on)

**Plans:** 4 plans

Plans:
- [ ] 13-01-PLAN.md -- Viewport, breakpoints, and safe area foundation
- [ ] 13-02-PLAN.md -- Responsive grid breakpoints for react-grid-layout
- [ ] 13-03-PLAN.md -- Responsive canvas instruments
- [ ] 13-04-PLAN.md -- Touch UX and polish

**Requirements:**
- REQ-218 -- Breakpoint system: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- REQ-219 -- Mobile layout: single-column stack of key instruments
- REQ-220 -- Tablet layout: 2-column grid
- REQ-221 -- Desktop layout: existing 3-column grid preserved or react-grid-layout equivalent
- REQ-222 -- Touch-friendly controls (44px minimum tap targets)
- REQ-223 -- Safe area insets for notched devices
- REQ-224 -- Viewport meta tag with viewport-fit=cover

**Success Criteria:**
1. On a phone (<640px), dashboard displays a single-column stack of key instruments with no horizontal scrolling
2. On a tablet (640-1024px), dashboard displays a 2-column grid with instruments and tactical panels
3. On desktop (>1024px), existing layout preserved (react-grid-layout with default positions)
4. All interactive elements meet 44px minimum tap target size on touch devices
5. Content renders correctly on notched devices with no overlap into system UI areas

---

#### Phase 14: Offline Shell & Polish

**Goal:** The app degrades gracefully when network drops and passes Lighthouse PWA checks -- users see a clear "CONNECTION LOST" state instead of a broken page, and the overall PWA implementation meets quality standards.

**Dependencies:** Phase 13 (responsive layout for offline overlay rendering)

**Plans:** 3 plans

Plans:
- [ ] 14-01-PLAN.md -- useOnlineStatus hook and offline overlay
- [ ] 14-02-PLAN.md -- Offline dashboard shell (panels render with "waiting for connection" state)
- [ ] 14-03-PLAN.md -- Lighthouse PWA audit, regression testing, final polish

**Requirements:**
- REQ-215 -- Online/offline status detection hook (useOnlineStatus)
- REQ-216 -- Offline overlay with "CONNECTION LOST" message and auto-reconnect indication
- REQ-217 -- Dashboard shell renders offline with "waiting for connection" state
- REQ-225 -- Lighthouse PWA-adjacent checks pass
- REQ-226 -- No regressions on desktop dashboard layout or functionality
- REQ-227 -- Service worker does NOT interfere with Supabase Realtime WebSocket

**Success Criteria:**
1. When network drops, user sees a "CONNECTION LOST" overlay within 3 seconds with an auto-reconnect indicator
2. The dashboard shell (panels, layout, JARVIS theme) renders fully offline with data areas showing "waiting for connection"
3. When network returns, the overlay disappears and telemetry resumes without manual page refresh
4. Lighthouse audit scores green on all PWA-adjacent checks
5. All v1.0 desktop dashboard functionality works identically after v2.0 changes -- no regressions

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
| 9. Font Size Overhaul | v2.0 | 0/2 | Not Started | -- |
| 10. Smart Connection Status | v2.0 | 0/2 | Not Started | -- |
| 11. Collapsible Widgets | v2.0 | 0/1 | Not Started | -- |
| 12. Draggable Layout | v2.0 | 0/3 | Not Started | -- |
| 13. Responsive Layout | v2.0 | 0/4 | Not Started | -- |
| 14. Offline Shell & Polish | v2.0 | 0/3 | Not Started | -- |

---
*Roadmap created: 2026-02-25*
*Last updated: 2026-03-13 -- Expanded v2.0 with UI amendments (phases 9-14)*
