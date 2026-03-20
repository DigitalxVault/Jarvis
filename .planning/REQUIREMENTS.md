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

- [x] **REQ-228** — Primary telemetry values (IAS, ALT, HDG, Mach, TAS) at minimum 36px font size
- [x] **REQ-229** — Canvas instrument values at increased sizes: G-meter 56px, VVI 48px, RPM 42px
- [x] **REQ-230** — Secondary labels (section headers 14-15px, unit labels 13-14px, sub-labels 12-13px, coaching/status text 13-14px)
- [x] **REQ-231** — Font conventions preserved throughout: tabular-nums, Courier New monospace, letter-spacing, line-height adjusted for new sizes

## Smart Connection Status (Amendment 3 + 4a + 4c)

- [x] **REQ-232** — ConnectionStatusPanel component with 4 states: INITIALIZING (cyan spinning) → SYSTEM INITIALIZED (amber static) → DCS ONLINE (green solid) → DCS OFFLINE (red static), replacing SessionPanel
- [x] **REQ-233** — DEV MODE removed entirely (no relocation, no keyboard shortcut — per D-902)
- [x] **REQ-234** — Top bar connection pill updated with state-aware labels/colors: INITIALIZING (cyan) / SYSTEM INIT (amber) / DCS ONLINE (green) / OFFLINE (red)
- [x] **REQ-235** — Coaching strip state-aware text: no session → "CREATE SESSION TO BEGIN", session but not connected → "AWAITING DCS LAUNCH", connected → live coaching data
- [x] **REQ-236** — Pairing code UI retained in ConnectionStatusPanel when session exists and bridge is unclaimed

## Collapsible Widgets (Amendment 4d)

- [x] **REQ-237** — CollapsibleWidget wrapper component with title bar toggle (click to collapse/expand body)
- [x] **REQ-238** — Chevron indicator: ▾ when open, ▸ when collapsed, matching panel-title styling
- [x] **REQ-239** — Collapsed state shows title bar only (body hidden), collapsed height matches standard panel-title height
- [x] **REQ-240** — Non-collapsible components excluded: ConnectionStatusPanel, MiniTelemetryCards, coaching strip, debug strip

## Draggable Layout (Amendment 1)

- [x] **REQ-241** — Custom CSS transform drag system (react-grid-layout rejected per D-1201) with zero dependencies
- [x] **REQ-242** — usePanelPositions hook with localStorage persistence (key: jarvis-panel-positions) and SSR safety (typeof window check)
- [x] **REQ-243** — Edit mode toggle button in top bar with cyan glow when active; layout locked and clean when inactive
- [x] **REQ-244** — DraggablePanel with CSS transform offsets, default positions matching current 3-column layout
- [x] **REQ-245** — Edit mode visual indicators: glowing border (1px solid rgba(0,255,255,0.35)) on panels
- [x] **REQ-246** — Free positioning via CSS transform offsets (no grid collision system needed)
- [x] **REQ-247** — Reset Layout button to clear localStorage and restore default positions
- [x] **REQ-248** — Mobile fallback at <768px viewport: stacked column layout, no drag-and-drop

## Offline Experience

- [x] **REQ-215** — Online/offline status detection hook (`useOnlineStatus`)
- [x] **REQ-216** — Offline overlay with "CONNECTION LOST" message and auto-reconnect indication
- [x] **REQ-217** — Dashboard shell renders offline (panels, layout, JARVIS theme) — data areas show "waiting for connection" state

## Responsive Layout

- [x] **REQ-218** — Breakpoint system: mobile (<768px), tablet/desktop (≥768px) — updated from original 640px per user feedback
- [x] **REQ-219** — Mobile layout: single-column with radar scope + telemetry strip (IAS, ALT, HDG, M), instrument panels hidden
- [x] **REQ-220** — Tablet layout: 3-column grid (240px | 1fr | 200px — scaled proportionally from desktop — D-1301)
- [x] **REQ-221** — Desktop layout: existing 3-column grid preserved with custom drag system
- [x] **REQ-222** — Touch-friendly controls: minimum 44px tap targets, appropriate spacing
- [x] **REQ-223** — Safe area insets for notched devices (`env(safe-area-inset-*)`)
- [x] **REQ-224** — Viewport meta tag with `viewport-fit=cover` for edge-to-edge rendering

## Quality & Polish

- [x] **REQ-225** — Lighthouse PWA-adjacent checks pass (manifest, SW, HTTPS, viewport, theme-color)
- [x] **REQ-226** — No regressions on desktop dashboard layout or functionality
- [x] **REQ-227** — Service worker does NOT interfere with Supabase Realtime WebSocket connections

---

## Out of Scope (v2.0)

- Push notifications (web-push, VAPID)
- Background sync
- Offline data storage (IndexedDB for telemetry)
- Training events / scoring / coaching
- DCS injection / audio cues
- Window Controls Overlay (desktop advanced title bar)

---

## Traceability (v2.0)

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
| REQ-228 | Font Size Overhaul | 9 | Complete |
| REQ-229 | Font Size Overhaul | 9 | Complete |
| REQ-230 | Font Size Overhaul | 9 | Complete |
| REQ-231 | Font Size Overhaul | 9 | Complete |
| REQ-232 | Smart Connection Status | 10 | Complete |
| REQ-233 | Smart Connection Status | 10 | Complete |
| REQ-234 | Smart Connection Status | 10 | Complete |
| REQ-235 | Smart Connection Status | 10 | Complete |
| REQ-236 | Smart Connection Status | 10 | Complete |
| REQ-237 | Collapsible Widgets | 11 | Complete |
| REQ-238 | Collapsible Widgets | 11 | Complete |
| REQ-239 | Collapsible Widgets | 11 | Complete |
| REQ-240 | Collapsible Widgets | 11 | Complete |
| REQ-241 | Draggable Layout | 12 | Complete |
| REQ-242 | Draggable Layout | 12 | Complete |
| REQ-243 | Draggable Layout | 12 | Complete |
| REQ-244 | Draggable Layout | 12 | Complete |
| REQ-245 | Draggable Layout | 12 | Complete |
| REQ-246 | Draggable Layout | 12 | Complete |
| REQ-247 | Draggable Layout | 12 | Complete |
| REQ-248 | Draggable Layout | 12 | Complete |
| REQ-218 | Responsive Layout | 13 | Complete |
| REQ-219 | Responsive Layout | 13 | Complete |
| REQ-220 | Responsive Layout | 13 | Complete |
| REQ-221 | Responsive Layout | 13 | Complete |
| REQ-222 | Responsive Layout | 13 | Complete |
| REQ-223 | Responsive Layout | 13 | Complete |
| REQ-224 | Responsive Layout | 13 | Complete |
| REQ-215 | Offline Experience | 14 | Complete |
| REQ-216 | Offline Experience | 14 | Complete |
| REQ-217 | Offline Experience | 14 | Complete |
| REQ-225 | Quality & Polish | 14 | Complete |
| REQ-226 | Quality & Polish | 14 | Complete |
| REQ-227 | Quality & Polish | 14 | Complete |

---
---

# Requirements: v3.0 — Voice Co-Pilot & Trainer Platform

**Milestone:** v3.0
**Created:** 2026-03-14
**Status:** Active (Phases 15-24 complete; integration fixes applied 2026-03-18)

---

## Prerequisites (PREREQ)

- [x] **REQ-300** — DCS-gRPC server mod installed and verified in DCS World
- [x] **REQ-301** — API accounts created: OpenAI (Whisper + GPT-4o), ElevenLabs (TTS), Picovoice (Porcupine wake word)
- [x] **REQ-302** — Python bridge project scaffold (pyproject.toml, virtual env, project structure)

## Python Bridge (BRIDGE)

- [x] **REQ-303** — Python bridge connects to DCS via DCS-gRPC and receives telemetry (position, attitude, speed, fuel, engine, weapons)
- [x] **REQ-304** — Python bridge publishes telemetry to Supabase REST broadcast (same channel format as v1.0: `session:{id}`)
- [x] **REQ-305** — Python bridge receives commands from Supabase Realtime (trainer actions) and executes via DCS-gRPC
- [x] **REQ-306** — Python bridge handles DCS disconnect with auto-retry and status reporting
- [x] **REQ-307** — Python bridge auto-opens browser to Jarvis web URL on startup
- [x] **REQ-308** — Heartbeat system (1 Hz) with DCS active/inactive status, packet count, queue depth

## Session & Connection (SESSION)

- [x] **REQ-309** — 4-digit numeric session codes (generated on player button press, not automatic)
- [x] **REQ-310** — Connection state machine: LAUNCHING → INITIALIZING → READY → SESSION_CREATED → CONNECTED → DCS_LINKED → IN_FLIGHT → DCS_DISCONNECTED (with auto-retry)
- [x] **REQ-311** — Player/trainer role routing on web app landing page
- [x] **REQ-312** — Session code registered in Supabase with metadata (player ID, timestamp, status)
- [x] **REQ-313** — Trainer joins session via 4-digit code; first trainer = controller, additional = observers

## TTS & Voice Output (TTS)

- [x] **REQ-314** — ElevenLabs TTS integration with streaming API for low-latency speech
- [x] **REQ-315** — Voice cues for all connection state transitions (welcome, system init, session code readout, DCS connected, DCS disconnected/reconnected)
- [x] **REQ-316** — Speech priority queue: P1 (safety-critical) interrupts, P2 (warnings) queues, P3 (info) waits for silence
- [x] **REQ-317** — Browser audio playback management (play through default audio device)

## Wake Word & STT (STT)

- [x] **REQ-318** — Picovoice Porcupine wake word detection ("Jarvis") running in-browser via WebAssembly
- [x] **REQ-319** — Audio buffering via Web Audio API after wake word detection (buffer until silence/timeout)
- [x] **REQ-320** — OpenAI Whisper API transcription of buffered audio clips
- [x] **REQ-321** — Voice input UI feedback (listening indicator, transcription display)

## Command Processing (CMD)

- [x] **REQ-322** — Rule engine for known commands: altitude, fuel, heading, airspeed, systems status (instant response from telemetry, no LLM call)
- [x] **REQ-323** — GPT-4o integration for complex/contextual queries with current DCS state as context
- [x] **REQ-324** — Response routing: rule engine gets first pass, LLM fallback for unmatched commands

## Flight Phase & Personality (PHASE)

- [x] **REQ-325** — Flight phase detection from telemetry: STARTUP, TAXI, CRUISE, COMBAT, LANDING
- [x] **REQ-326** — Personality adapter: tone/brevity adjusts per flight phase (relaxed cruise, sharp combat, focused landing)
- [x] **REQ-327** — Phase tag passed to rule engine (response templates) and GPT-4o (system prompt)

## Proactive Alerts (ALERT)

- [x] **REQ-328** — Threshold monitoring system with configurable limits (altitude, fuel, stall, RWR, engine temp, waypoint, phase change)
- [x] **REQ-329** — Alert generation with flight-phase-aware personality (casual cruise vs urgent combat callouts)
- [x] **REQ-330** — Priority queue integration: P1 alerts interrupt speech, P2 queue behind, P3 wait for silence

## Trainer Visibility (TVIEW)

- [x] **REQ-331** — Trainer dashboard with live telemetry panels (altitude, airspeed, heading, fuel, engine, G-force)
- [x] **REQ-332** — Custom canvas Tactical Situation Display (TSD): player-centered square canvas with range rings (5/10/20nm), enemy contacts as hostile blips, waypoint markers, north-up orientation, JARVIS HUD aesthetic (dark bg, cyan/green/red, Courier New) — no real-world map library
- [x] **REQ-333** — Flight phase indicator and timestamped events log (weapons fired, targets destroyed, phase transitions)
- [x] **REQ-334** — Full Jarvis conversation log (player queries + Jarvis responses + proactive alerts)

## Trainer Communication (TCOMM)

- [x] **REQ-335** — PTT voice input: trainer speaks → Whisper → GPT-4o rephrases to aviation terminology + Jarvis tone → ElevenLabs speaks as Jarvis
- [x] **REQ-336** — Template button system with configurable library (situational awareness, approach, combat, mission, encouragement categories)
- [x] **REQ-337** — Custom text box: trainer types → GPT-4o rephrases → ElevenLabs speaks as Jarvis
- [x] **REQ-338** — Player cannot distinguish trainer-relayed speech from AI-generated Jarvis speech

## Trainer DCS Controls (TCTRL)

- [x] **REQ-339** — Spawn enemy units: type, count, distance, bearing, altitude → Python bridge → DCS-gRPC
- [x] **REQ-340** — Set AI objectives: target group, objective type (CAP, fighter sweep, idle) → DCS-gRPC
- [x] **REQ-341** — Alert threshold configuration: parameter, operator, value → updates threshold monitor
- [x] **REQ-342** — Mission injection: waypoint coordinates, objective description → DCS-gRPC

## Trainer Roles (TROLE)

- [x] **REQ-343** — Controller role (first to join): full dashboard + communication + DCS controls
- [x] **REQ-344** — Observer role (additional trainers): read-only view of all panels, no controls

---

## Out of Scope (v3.0)

- Mobile app (native iOS/Android)
- Multiplayer squad sessions (multi-player in same session)
- Standalone .exe packaging for Python bridge
- Post-flight replay / debrief system
- Custom voice cloning (use ElevenLabs library voice)

---

## Traceability (v3.0)

| REQ-ID | Category | Phase | Status |
|--------|----------|-------|--------|
| REQ-300 | Prerequisites | 15 | Complete |
| REQ-301 | Prerequisites | 17, 18 | Complete |
| REQ-302 | Prerequisites | 15 | Complete |
| REQ-303 | Python Bridge | 15 | Complete |
| REQ-304 | Python Bridge | 15 | Complete |
| REQ-305 | Python Bridge | 23 | Complete |
| REQ-306 | Python Bridge | 15 | Complete |
| REQ-307 | Python Bridge | 15 | Complete |
| REQ-308 | Python Bridge | 15 | Complete |
| REQ-309 | Session & Connection | 16 | Complete |
| REQ-310 | Session & Connection | 16 | Complete |
| REQ-311 | Session & Connection | 16 | Complete |
| REQ-312 | Session & Connection | 16 | Complete |
| REQ-313 | Session & Connection | 16 | Complete |
| REQ-314 | TTS & Voice Output | 17 | Complete |
| REQ-315 | TTS & Voice Output | 17 | Complete |
| REQ-316 | TTS & Voice Output | 17 | Complete |
| REQ-317 | TTS & Voice Output | 17 | Complete |
| REQ-318 | Wake Word & STT | 18 | Complete |
| REQ-319 | Wake Word & STT | 18 | Complete |
| REQ-320 | Wake Word & STT | 18 | Complete |
| REQ-321 | Wake Word & STT | 18 | Complete |
| REQ-322 | Command Processing | 19 | Complete |
| REQ-323 | Command Processing | 19 | Complete |
| REQ-324 | Command Processing | 19 | Complete |
| REQ-325 | Flight Phase & Personality | 20 | Complete |
| REQ-326 | Flight Phase & Personality | 20 | Complete |
| REQ-327 | Flight Phase & Personality | 20 | Complete |
| REQ-328 | Proactive Alerts | 20 | Complete |
| REQ-329 | Proactive Alerts | 20 | Complete |
| REQ-330 | Proactive Alerts | 20 | Complete |
| REQ-331 | Trainer Visibility | 21 | Complete |
| REQ-332 | Trainer Visibility | 21 | Complete |
| REQ-333 | Trainer Visibility | 21 | Complete |
| REQ-334 | Trainer Visibility | 21 | Complete |
| REQ-335 | Trainer Communication | 22 | Complete |
| REQ-336 | Trainer Communication | 22 | Complete |
| REQ-337 | Trainer Communication | 22 | Complete |
| REQ-338 | Trainer Communication | 22 | Complete |
| REQ-339 | Trainer DCS Controls | 23 | Complete |
| REQ-340 | Trainer DCS Controls | 23 | Complete |
| REQ-341 | Trainer DCS Controls | 23 | Complete |
| REQ-342 | Trainer DCS Controls | 23 | Complete |
| REQ-343 | Trainer Roles | 24 | Complete |
| REQ-344 | Trainer Roles | 26 | Complete |
