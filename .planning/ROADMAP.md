# Roadmap: JARVIS DCS

## Milestones

- SHIPPED **v1.0 MVP** -- Phases 1-7 (shipped 2026-02-25) -- [archive](milestones/v1.0-ROADMAP.md)
- SHIPPED **v2.0 PWA + Responsive Layout + UI Amendments** -- Phases 8-14 (shipped 2026-03-15)
- ACTIVE **v3.0 Voice Co-Pilot & Trainer Platform** -- Phases 15-24

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

**Plans:** 3 plans

Plans:
- [x] 09-01-PLAN.md -- DOM component font sizes (mini-telemetry-cards, fuel-gauge, aoa-indicator, coaching/debug strips, bottom-bar)
- [x] 09-02-PLAN.md -- Canvas instrument font sizes (engine-panel, g-meter, vvi-tape, ADI) with Y-offset recalculation
- [x] 09-03-PLAN.md -- Remaining component font sizes (top-bar, session-panel, dashboard, alert-overlay, tactical panels, radar scope canvas, PWA prompts, utility components)

**Requirements:**
- REQ-228 -- Primary telemetry values at minimum 36px
- REQ-229 -- Canvas instrument values (G-meter 56px, VVI 48px, RPM 42px)
- REQ-230 -- Secondary labels at 12-15px range
- REQ-231 -- Font conventions preserved (tabular-nums, Courier New, letter-spacing)

**Success Criteria:**
1. Primary telemetry values (IAS, ALT, HDG, Mach, TAS) render at 36px+ and are readable at arm's length
2. Canvas instruments (G-meter, VVI, RPM, ADI) display values at specified increased sizes with correct positioning
3. All secondary labels, unit text, and coaching/debug strips use increased font sizes per Amendment 2 spec
4. No component in the web app has font sizes below 12px
5. Font styling conventions (tabular-nums, Courier New, letter-spacing, uppercase) are preserved throughout
6. `pnpm typecheck` passes clean after all changes

---

#### Phase 10: Smart Connection Status (Amendment 3 + 4a + 4c)

**Goal:** Replace the confusing START SESSION / DEV MODE buttons with a smart, animated 4-state connection status display that automatically progresses through connection states.

**Dependencies:** Phase 9 (font sizes applied; status panel uses the new font size conventions)

**Plans:** 2 plans

Plans:
- [x] 10-01-PLAN.md -- ConnectionStatusPanel component (replaces SessionPanel) with 4-state machine + DEV MODE removal from provider
- [x] 10-02-PLAN.md -- Top bar connection pill update (4a) + coaching strip state text (4c) + dashboard wiring + session-panel.tsx deletion

**Requirements:**
- REQ-232 -- ConnectionStatusPanel with 4 states (INITIALIZING -> SYSTEM INITIALIZED -> DCS ONLINE -> DCS OFFLINE)
- REQ-233 -- DEV MODE removed entirely (per CONTEXT.md -- no relocation, no keyboard shortcut)
- REQ-234 -- Top bar connection pill with state-aware labels/colors
- REQ-235 -- Coaching strip state-aware text (3 states)
- REQ-236 -- Pairing code UI retained when applicable

**Success Criteria:**
1. ConnectionStatusPanel shows correct state based on connection lifecycle (no session -> session created -> telemetry flowing -> connection lost)
2. Status dot, title, and sub-text match the visual spec for each state
3. Top bar pill reflects connection state with correct labels and colors
4. Coaching strip shows "AWAITING DCS LAUNCH" when session exists but DCS not connected
5. DEV MODE is removed entirely -- no button, no keyboard shortcut, no debug toggle
6. `pnpm typecheck` passes clean

---

#### Phase 11: Collapsible Widgets (Amendment 4d)

**Goal:** Instrument panels can be collapsed to just their title bar, letting pilots declutter the screen and making panels easier to reposition in future drag mode.

**Dependencies:** Phase 10 (connection status panel finalized; defines which components are non-collapsible)

**Plans:** 1 plan

Plans:
- [x] 11-01-PLAN.md -- CollapsibleWidget component + wrap instrument panels (Fuel, Engine, G-Meter, AoA, VVI)

**Requirements:**
- REQ-237 -- CollapsibleWidget wrapper component with title bar toggle
- REQ-238 -- Chevron indicator (open / closed)
- REQ-239 -- Collapsed state shows title bar only
- REQ-240 -- Non-collapsible components excluded (ConnectionStatusPanel, MiniTelemetryCards, coaching, debug)

**Success Criteria:**
1. Clicking a widget title bar (FUEL, ENGINE, G-METER, ANGLE OF ATTACK, VERTICAL SPEED) toggles collapse/expand
2. Collapsed state shows only the title bar with closed chevron; expanded shows open chevron with full content
3. ConnectionStatusPanel, top center telemetry cards, coaching strip, and debug strip are NOT collapsible
4. `pnpm typecheck` passes clean

---

#### Phase 12: Draggable Layout (Amendment 1)

**Goal:** Every telemetry widget is individually draggable and freely positionable using custom CSS transforms, with localStorage persistence, edit mode toggle, and mobile fallback.

**Dependencies:** Phase 11 (collapsible widgets provide the wrapper components that become grid items)

**Plans:** 1 plan

Plans:
- [x] 12-01-PLAN.md -- Custom CSS transform drag system with edit mode, localStorage persistence, reset layout

**Requirements:**
- REQ-242 -- usePanelPositions hook with localStorage persistence + SSR safety
- REQ-243 -- Edit mode toggle in top bar (cyan glow when active)
- REQ-245 -- Edit mode visual indicators (glow borders)
- REQ-247 -- Reset Layout button

**Success Criteria:**
1. In edit mode, all panels are draggable with visible glow borders
2. Layout persists to localStorage and survives page refresh
3. Reset Layout button restores default positions
4. `pnpm typecheck` and `pnpm --filter @jarvis-dcs/web lint` pass clean

---

#### Phase 13: Responsive Layout

**Goal:** Dashboard renders correctly on phones, tablets, and desktops -- pilots can glance at key instruments on a phone mounted in their cockpit or use the full dashboard on a monitor.

**Dependencies:** Phase 12 (draggable layout with custom CSS transforms establishes the grid system that responsive breakpoints build on)

**Plans:** 4 plans

Plans:
- [x] 13-01-PLAN.md -- Viewport, safe area utilities, responsive top bar and bottom bar
- [x] 13-02-PLAN.md -- Responsive dashboard grid with mobile single-column and drag disable
- [x] 13-03-PLAN.md -- Canvas instrument text fallbacks for mobile
- [x] 13-04-PLAN.md -- Touch UX polish, radar center, logo relocation, md breakpoint harmonization

**Requirements:**
- REQ-218 -- Breakpoint system: mobile (<640px), tablet (640-1024px), desktop (>1024px)
- REQ-219 -- Mobile layout: single-column stack of key instruments
- REQ-220 -- Tablet layout: 3-column grid (scaled proportionally from desktop — D-1301)
- REQ-221 -- Desktop layout: existing 3-column grid preserved with custom drag system
- REQ-222 -- Touch-friendly controls (44px minimum tap targets)
- REQ-223 -- Safe area insets for notched devices
- REQ-224 -- Viewport meta tag with viewport-fit=cover

**Success Criteria:**
1. On a phone (<640px), dashboard displays a single-column stack of key instruments with no horizontal scrolling
2. On a tablet (640-1024px), dashboard displays 3-column grid with instruments and tactical panels
3. On desktop (>1024px), existing layout preserved (custom drag system with default positions)
4. All interactive elements meet 44px minimum tap target size on touch devices
5. Content renders correctly on notched devices with no overlap into system UI areas

---

#### Phase 14: Offline Shell & Polish

**Goal:** The app degrades gracefully when network drops and passes Lighthouse PWA checks -- users see a clear "CONNECTION LOST" state instead of a broken page, and the overall PWA implementation meets quality standards.

**Dependencies:** Phase 13 (responsive layout for offline overlay rendering)

**Plans:** 3 plans

Plans:
- [x] 14-01-PLAN.md -- useOnlineStatus hook and offline overlay
- [x] 14-02-PLAN.md -- Offline dashboard shell (panels render with "waiting for connection" state)
- [x] 14-03-PLAN.md -- Lighthouse PWA audit, regression testing, final polish

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

---

### v3.0 Voice Co-Pilot & Trainer Platform

---

#### Phase 15: Python Bridge + DCS-gRPC Foundation

**Goal:** Python bridge connects to DCS via gRPC, extracts telemetry, publishes to Supabase in the same format as the Node.js bridge.

**Dependencies:** v2.0 complete (Phases 10-14); DCS-gRPC mod installed

**Plans:** 4 plans in 3 waves

Plans:
- [x] 15-01-PLAN.md -- Scaffold: uv project, Pydantic models, JSON Schema, proto stubs, minimal Export.lua
- [x] 15-02-PLAN.md -- gRPC client + UDP listener + normalizer (hybrid telemetry streams)
- [x] 15-03-PLAN.md -- Supabase REST publisher + heartbeat system
- [x] 15-04-PLAN.md -- Main entry point, Rich TUI, CLI, resilience, pnpm wiring

**Requirements:**
- REQ-300 -- DCS-gRPC mod installed and verified
- REQ-302 -- Python bridge scaffold
- REQ-303 -- DCS-gRPC telemetry connection
- REQ-304 -- Supabase REST broadcast
- REQ-306 -- DCS disconnect handling
- REQ-307 -- Auto-open browser
- REQ-308 -- Heartbeat system

**Success Criteria:**
1. Python bridge receives telemetry from DCS via gRPC and publishes to Supabase at 4 Hz
2. Existing web dashboard displays telemetry from Python bridge identically to Node.js bridge
3. Bridge auto-retries on DCS disconnect with exponential backoff
4. Heartbeat at 1 Hz with DCS status, packet count, queue depth
5. Browser auto-opens to Jarvis web URL on bridge startup

**Key Risk:** DCS-gRPC API surface — needs validation against actual mod

---

#### Phase 16: Session & Connection Overhaul

**Goal:** New 4-digit session codes, updated connection state machine, player/trainer role routing.

**Dependencies:** Phase 15 (Python bridge operational)

**Plans:** 2 plans

Plans:
- [x] 16-01-PLAN.md -- Session overhaul (4-digit codes, player-initiated, Supabase metadata)
- [x] 16-02-PLAN.md -- Role routing + connection state machine (LAUNCHING → IN_FLIGHT → DCS_DISCONNECTED)

**Requirements:**
- REQ-309 -- 4-digit numeric session codes
- REQ-310 -- Connection state machine (8 states)
- REQ-311 -- Player/trainer role routing
- REQ-312 -- Session metadata in Supabase
- REQ-313 -- Trainer joins via code (controller/observer)

**Success Criteria:**
1. Player presses button to generate 4-digit code; code appears on screen and in Supabase
2. Connection transitions through all 8 states with correct UI feedback
3. Landing page presents player/trainer role choice
4. Trainer can join session via 4-digit code; first trainer = controller

---

#### Phase 17: TTS Foundation + Voice Cues

**Goal:** Jarvis speaks — connection state voice cues, streaming TTS, priority queue.

**Dependencies:** Phase 16 (connection states defined for voice cues)

**Plans:** ~3 plans

Plans:
- [x] 17-01-PLAN.md -- ElevenLabs TTS client (streaming API, browser audio playback)
- [x] 17-02-PLAN.md -- Voice cue system (connection state transitions → speech)
- [x] 17-03-PLAN.md -- Speech priority queue (P1 interrupt, P2 queue, P3 wait)

**Requirements:**
- REQ-301 -- ElevenLabs API key
- REQ-314 -- ElevenLabs TTS streaming integration
- REQ-315 -- Voice cues for connection transitions
- REQ-316 -- Speech priority queue (P1/P2/P3)
- REQ-317 -- Browser audio playback management

**Success Criteria:**
1. Jarvis speaks welcome message on app load via ElevenLabs streaming TTS
2. All connection state transitions trigger appropriate voice cues
3. P1 speech interrupts current playback; P2 queues; P3 waits for silence
4. Audio plays through default browser audio device

---

#### Phase 18: Wake Word + STT Pipeline

**Goal:** Player can say "Jarvis" to activate, audio is captured and transcribed.

**Dependencies:** Phase 17 (TTS must work for response playback)

**Plans:** 2 plans

Plans:
- [x] 18-01-PLAN.md -- Porcupine wake word + Web Audio API buffering
- [x] 18-02-PLAN.md -- Whisper STT integration + voice input UI feedback

**Requirements:**
- REQ-301 -- Picovoice + OpenAI API keys
- REQ-318 -- Porcupine wake word ("Jarvis") in-browser WASM
- REQ-319 -- Audio buffering after wake word (until silence/timeout)
- REQ-320 -- Whisper API transcription
- REQ-321 -- Voice input UI (listening indicator, transcription display)

**Success Criteria:**
1. Saying "Jarvis" activates listening mode within 500ms
2. Audio is buffered until silence (1.5s) or timeout (10s)
3. Buffered audio is transcribed via Whisper API with >90% accuracy
4. UI shows listening state and transcription result

---

#### Phase 19: Command Processing (Rule Engine + LLM)

**Goal:** Jarvis understands and responds to player voice commands.

**Dependencies:** Phase 18 (STT provides transcribed text)

**Plans:** 2 plans

Plans:
- [x] 19-01-PLAN.md -- Rule engine (known commands → telemetry lookup → instant response)
- [x] 19-02-PLAN.md -- GPT-4o integration (complex queries with DCS state context)

**Requirements:**
- REQ-322 -- Rule engine for known commands (altitude, fuel, heading, airspeed, status)
- REQ-323 -- GPT-4o for complex/contextual queries
- REQ-324 -- Response routing (rule engine first, LLM fallback)

**Success Criteria:**
1. "What's my altitude?" returns instant telemetry response (no LLM call)
2. Complex queries ("Am I on course for waypoint 3?") route to GPT-4o with current DCS state
3. Rule engine responds in <200ms; LLM responds in <3s
4. All responses spoken via TTS pipeline

---

#### Phase 20: Flight Phase, Personality & Proactive Alerts

**Goal:** Jarvis adapts tone to flight phase and proactively alerts on dangerous conditions.

**Dependencies:** Phase 19 (command processing provides response generation infrastructure)

**Plans:** 2 plans

Plans:
- [x] 20-01-PLAN.md -- Flight phase detection + personality adapter
- [x] 20-02-PLAN.md -- Proactive alert system (thresholds → phase-aware callouts → priority queue)

**Requirements:**
- REQ-325 -- Flight phase detection (STARTUP, TAXI, CRUISE, COMBAT, LANDING)
- REQ-326 -- Personality adapter (relaxed cruise, sharp combat, focused landing)
- REQ-327 -- Phase tag for rule engine templates and GPT-4o system prompt
- REQ-328 -- Threshold monitoring (altitude, fuel, stall, RWR, engine temp, waypoint, phase change)
- REQ-329 -- Phase-aware alert personality
- REQ-330 -- Alert priority queue integration (P1/P2/P3)

**Success Criteria:**
1. Flight phase correctly detected from telemetry (gear state, speed, altitude, weapons)
2. Jarvis tone shifts noticeably between cruise ("You're looking good") and combat ("Bandit, 3 o'clock low")
3. Low fuel alert fires with phase-appropriate urgency
4. P1 alerts interrupt current speech; alerts don't spam during rapid state changes

---

#### Phase 21: Trainer Session & Dashboard

**Goal:** Trainer can join a session, see live telemetry, tactical display, events, and conversation.

**Dependencies:** Phase 20 (flight phases and alerts provide data for trainer panels)

**Plans:** ~3 plans

Plans:
- [x] 21-01-PLAN.md -- Trainer entry flow + live telemetry panels
- [x] 21-02-PLAN.md -- Canvas Tactical Situation Display (TSD)
- [x] 21-03-PLAN.md -- Events log + conversation log panels

**Requirements:**
- REQ-331 -- Trainer telemetry panels (altitude, airspeed, heading, fuel, engine, G-force)
- REQ-332 -- Canvas TSD (player-centered, range rings, hostile blips, waypoints, JARVIS aesthetic)
- REQ-333 -- Flight phase indicator + timestamped events log
- REQ-334 -- Full Jarvis conversation log

**Success Criteria:**
1. Trainer sees live telemetry updating at same rate as player dashboard
2. TSD shows player position centered with range rings (5/10/20nm), enemy blips, and waypoints
3. Events log shows timestamped entries for weapons fired, targets destroyed, phase transitions
4. Conversation log shows all player queries, Jarvis responses, and proactive alerts

---

#### Phase 22: Trainer Communication

**Goal:** Trainer speaks through Jarvis — PTT voice, templates, text — player can't tell the difference.

**Dependencies:** Phase 21 (trainer dashboard provides the UI context)

**Plans:** 2 plans

Plans:
- [x] 22-01-PLAN.md -- PTT voice + text input → GPT-4o rephrase → ElevenLabs TTS
- [x] 22-02-PLAN.md -- Template button system (categorized library)

**Requirements:**
- REQ-335 -- PTT voice → Whisper → GPT-4o rephrase → ElevenLabs as Jarvis
- REQ-336 -- Template buttons (SA, approach, combat, mission, encouragement)
- REQ-337 -- Text box → GPT-4o rephrase → ElevenLabs as Jarvis
- REQ-338 -- Player cannot distinguish trainer speech from AI speech

**Success Criteria:**
1. Trainer holds PTT, speaks naturally; player hears Jarvis voice with aviation terminology
2. Template buttons produce contextual Jarvis speech in <2s
3. Trainer text input rephrased and spoken as Jarvis in <3s
4. Player has no way to tell if Jarvis is AI-driven or trainer-driven

---

#### Phase 23: Trainer DCS Controls

**Goal:** Trainer can spawn enemies, set objectives, configure alerts, inject missions via DCS-gRPC.

**Dependencies:** Phase 22 (trainer communication operational; controls complement voice interaction)

**Plans:** 2 plans

Plans:
- [x] 23-01-PLAN.md -- Spawn units + set AI objectives (UI → bridge → gRPC)
- [x] 23-02-PLAN.md -- Alert threshold config + mission injection (waypoints, objectives)

**Requirements:**
- REQ-305 -- Python bridge receives commands from Supabase Realtime → DCS-gRPC
- REQ-339 -- Spawn enemy units (type, count, distance, bearing, altitude)
- REQ-340 -- Set AI objectives (CAP, fighter sweep, idle)
- REQ-341 -- Alert threshold configuration
- REQ-342 -- Mission injection (waypoint coordinates, objective description)

**Success Criteria:**
1. Trainer spawns 2x MiG-29 at 20nm, bearing 090, angels 20 — units appear in DCS within 2s
2. Trainer sets fighter sweep objective — AI units begin engagement
3. Trainer adjusts altitude floor alert — player gets new callout at configured threshold
4. Mission waypoints appear on player's navigation system via DCS-gRPC

---

#### Phase 24: Roles, Integration & Polish

**Goal:** Observer role works, end-to-end flows tested, error handling solid.

**Dependencies:** Phase 23 (all features built; this phase integrates and polishes)

**Plans:** 2 plans

Plans:
- [x] 24-01-PLAN.md -- Session lifecycle (end session, trainer notification, exit flow)
- [x] 24-02-PLAN.md -- Memory leak fixes, error hardening, loading states, integration audit

**Requirements:**
- REQ-343 -- Controller role (full access)
- REQ-344 -- Observer role (read-only)

**Success Criteria:**
1. Observer sees all trainer panels but cannot send commands, speak, or modify alerts
2. Full end-to-end flow works: player flies → trainer observes → trainer speaks through Jarvis → trainer spawns enemies → alerts fire → player responds
3. All error paths handled gracefully (DCS disconnect, API timeout, mic permission denied)
4. No memory leaks in 30-minute trainer session

---

#### Phase 25: Supabase Schema & RLS

**Goal:** Add missing `trainer_code` column to sessions table and enable Row Level Security with proper policies — closing the schema gap and the security debt carried since v1.0.

**Dependencies:** Phase 24 (all features complete; schema and security are prerequisites for production testing)

**Plans:** 2 plans in 2 waves

Plans:
- [ ] 25-01-PLAN.md — trainer_code column migration + sessions table schema alignment
- [ ] 25-02-PLAN.md — RLS policies for sessions table (NextAuth-compatible, unauthenticated endpoints safe)

**Requirements:**
- Tech debt: trainer_code column missing from sessions table (blocks trainer flow in production)
- Tech debt: Supabase RLS disabled since v1.0 (security gap)

**Gap Closure:** Closes tech debt items from v3.0 milestone audit

**Success Criteria:**
1. `trainer_code` column exists in sessions table with UNIQUE constraint
2. All existing API routes (`/api/sessions`, `/api/bridge/claim`, `/api/trainer/claim`, `/api/sessions/[id]/trainer-code`) work correctly with the new column
3. RLS enabled on sessions table with policies that allow: owner reads/writes, unauthenticated bridge claim via pairing code, unauthenticated trainer claim via trainer code, service role bypass
4. `pnpm typecheck` passes clean

---

#### Phase 26: Observer Role (REQ-344)

**Goal:** Implement the observer trainer role — additional trainers joining a session see all dashboard panels but cannot send commands, speak, or modify alerts.

**Dependencies:** Phase 25 (schema migrations applied; observer needs trainer_role column)

**Plans:** TBD

Plans:
- [ ] 26-01-PLAN.md — trainer_role column, role assignment in claim API, role context in trainer dashboard
- [ ] 26-02-PLAN.md — Observer UI restrictions (disable controls, PTT, text input, template buttons, DCS commands)

**Requirements:**
- REQ-344 — Observer role (read-only view of all panels, no controls)

**Gap Closure:** Closes deferred requirement from v3.0 milestone audit

**Success Criteria:**
1. First trainer to claim a session is assigned `controller` role with full access
2. Additional trainers are assigned `observer` role with read-only access
3. Observer sees all trainer panels (telemetry, TSD, events, conversation) updating live
4. Observer cannot: send PTT/text messages, use template buttons, spawn units, set objectives, configure alerts, inject missions, end session
5. Observer UI clearly indicates read-only state (disabled controls, visual indicator)
6. `pnpm typecheck` passes clean

---

#### Phase 27: Code Cleanup & Verification

**Goal:** Remove dead code, generate missing verification documents, and perform final audit to confirm all tech debt is resolved.

**Dependencies:** Phase 26 (all feature work complete; this phase is cleanup only)

**Plans:** TBD

Plans:
- [ ] 27-01-PLAN.md — Dead code removal + missing VERIFICATION.md generation for phases 15-20
- [ ] 27-02-PLAN.md — Final milestone audit (re-run to confirm zero gaps and zero tech debt)

**Requirements:**
- Tech debt: `'connecting'` PageState dead code in trainer/page.tsx
- Tech debt: Phases 15-20 lack formal VERIFICATION.md files

**Gap Closure:** Closes remaining tech debt items from v3.0 milestone audit

**Success Criteria:**
1. `'connecting'` removed from PageState type and conditional check in trainer/page.tsx
2. VERIFICATION.md files exist for phases 15-20 with verification results
3. `pnpm typecheck` and `pnpm --filter @jarvis-dcs/web lint` pass clean
4. Re-audit confirms zero gaps and zero tech debt

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
| 9. Font Size Overhaul | v2.0 | 3/3 | Complete | 2026-03-13 |
| 10. Smart Connection Status | v2.0 | 2/2 | Complete | 2026-03-14 |
| 11. Collapsible Widgets | v2.0 | 1/1 | Complete | 2026-03-15 |
| 12. Draggable Layout | v2.0 | 1/1 | Complete | 2026-03-15 |
| 13. Responsive Layout | v2.0 | 4/4 | Complete | 2026-03-15 |
| 14. Offline Shell & Polish | v2.0 | 3/3 | Complete | 2026-03-15 |
| 15. Python Bridge + DCS-gRPC | v3.0 | 4/4 | Complete | 2026-03-16 |
| 16. Session & Connection Overhaul | v3.0 | 2/2 | Complete | 2026-03-16 |
| 17. TTS Foundation + Voice Cues | v3.0 | 3/3 | Complete | 2026-03-17 |
| 18. Wake Word + STT Pipeline | v3.0 | 2/2 | Complete | 2026-03-17 |
| 19. Command Processing | v3.0 | 2/2 | Complete | 2026-03-17 |
| 20. Flight Phase & Proactive Alerts | v3.0 | 2/2 | Complete | 2026-03-17 |
| 21. Trainer Session & Dashboard | v3.0 | 3/3 | Complete | 2026-03-17 |
| 22. Trainer Communication | v3.0 | 2/2 | Complete | 2026-03-18 |
| 23. Trainer DCS Controls | v3.0 | 2/2 | Complete | 2026-03-18 |
| 24. Roles, Integration & Polish | v3.0 | 2/2 | Complete | 2026-03-18 |
| 25. Supabase Schema & RLS | v3.0 | 0/2 | Not Started | — |
| 26. Observer Role (REQ-344) | v3.0 | 0/2 | Not Started | — |
| 27. Code Cleanup & Verification | v3.0 | 0/2 | Not Started | — |

---
*Roadmap created: 2026-02-25*
*Last updated: 2026-03-18 -- Gap closure phases 25-27 added to close tech debt from v3.0 audit*
