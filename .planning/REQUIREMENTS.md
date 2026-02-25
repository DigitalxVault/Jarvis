# Requirements: JARVIS DCS Prototype

**Defined:** 2026-02-25
**Core Value:** Live telemetry from DCS appears on a web dashboard in under 500ms — the pipeline works end-to-end and stays stable for a 20-minute flight session.

## v1 Requirements

Requirements for Phase 1 prototype. Each maps to roadmap phases.

### Connectivity

- [ ] **CONN-01**: DCS Export.lua sends JSON telemetry at 10Hz via UDP to localhost with dofile() chaining for compatibility with TacView/SRS/Helios
- [ ] **CONN-02**: Node.js bridge receives UDP packets, downsamples to 2-5Hz, and publishes to Supabase Realtime Broadcast via REST API
- [ ] **CONN-03**: Web UI subscribes to session-scoped Supabase Realtime channel and receives telemetry broadcasts in real-time
- [ ] **CONN-04**: Session pairing: web generates short-lived 6-char code, bridge claims via Next.js API route, receives scoped channelName + bridgeToken

### Telemetry Display

- [ ] **TELEM-01**: IAS card displays live indicated airspeed converted to knots
- [ ] **TELEM-02**: ALT card displays live altitude MSL converted to feet
- [ ] **TELEM-03**: HDG card displays live heading converted to degrees
- [ ] **TELEM-04**: Dashboard uses JARVIS HUD visual theme (dark background, high-tech card styling, HUD-style typography)

### Authentication

- [ ] **AUTH-01**: User can sign in with Google via NextAuth.js v5, session persists across browser refresh
- [ ] **AUTH-02**: Authenticated user can create a live session and receive a 6-character pairing code displayed on screen
- [ ] **AUTH-03**: User can view a list of past sessions with timestamps, status (active/ended), and session ID

### Resilience

- [ ] **RESIL-01**: Connection status indicator displays at least 3 states: Connected, Reconnecting, Offline
- [ ] **RESIL-02**: Bridge auto-reconnects to Supabase with exponential backoff after internet loss; telemetry resumes without creating duplicate sessions
- [ ] **RESIL-03**: Bridge staleness watchdog detects DCS exporter going silent and reports "No telemetry" status within N seconds
- [ ] **RESIL-04**: Web UI re-subscribes to Supabase Realtime channel when browser tab returns from background (Page Visibility API)

### Debug

- [ ] **DEBUG-01**: Web debug panel shows last packet time, packets/sec (smoothed), session ID, and Supabase subscription status
- [ ] **DEBUG-02**: Bridge logs pairing success/failure, receive packet count, publish success/failure + retry count, and queue size to console
- [ ] **DEBUG-03**: Web raw packet viewer shows last N telemetry packets as expandable JSON entries

## v2 Requirements

Deferred to future phases. Tracked but not in current roadmap.

### Training Events

- **EVENT-01**: Mission scripting detects trigger zones (enter/exit/pass/fail gates)
- **EVENT-02**: Kill events with score deltas (+50 for choppers)
- **EVENT-03**: Event feed displayed in UI with timestamps and score deltas
- **EVENT-04**: Cumulative score display

### Coaching

- **COACH-01**: Rule-based coaching engine (IAS/ALT band checks)
- **COACH-02**: Coaching prompts displayed in UI
- **COACH-03**: Configurable thresholds per mission

### DCS Injection

- **INJECT-01**: On-screen messages via trigger.action.outText
- **INJECT-02**: Audio cue sounds
- **INJECT-03**: Mission flag manipulation

### Audio

- **AUDIO-01**: JARVIS voice cues for session start/end
- **AUDIO-02**: JARVIS voice cues for gate events
- **AUDIO-03**: Rate-limited critical warnings (stall, low altitude)

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Multiplayer support | Phase 4; prototype is single-pilot only |
| Instructor view | Phase 4; requires multi-session aggregation |
| Mobile / tablet layout | Desktop only; pilot is at a PC |
| Standalone .exe bridge packaging | npm script sufficient for prototype |
| Mission scripting (gates/triggers) | Phase 2; prototype uses Export.lua only |
| Voice commands to aircraft | Non-goal per PRD Section 2.2 |
| Automatic mission file creation | Non-goal per PRD Section 2.2 |
| Replay / after-action review | Phase 4; requires stored telemetry |
| JARVIS splash screen + eye scan animation | Phase 2+; prototype focuses on pipeline proof |
| Session auto-end on timeout | Phase 2; manual end sufficient for prototype |

## Traceability

Which phases cover which requirements. Updated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| CONN-01 | Phase 3 - DCS Export.lua | Pending |
| CONN-02 | Phase 2 - Bridge Core | Pending |
| CONN-03 | Phase 4 - Web UI Foundation | Pending |
| CONN-04 | Phase 5 - Session Pairing | Pending |
| TELEM-01 | Phase 6 - Telemetry UI | Pending |
| TELEM-02 | Phase 6 - Telemetry UI | Pending |
| TELEM-03 | Phase 6 - Telemetry UI | Pending |
| TELEM-04 | Phase 6 - Telemetry UI | Pending |
| AUTH-01 | Phase 4 - Web UI Foundation | Pending |
| AUTH-02 | Phase 5 - Session Pairing | Pending |
| AUTH-03 | Phase 4 - Web UI Foundation | Pending |
| RESIL-01 | Phase 6 - Telemetry UI | Pending |
| RESIL-02 | Phase 7 - Resilience and Stability | Pending |
| RESIL-03 | Phase 7 - Resilience and Stability | Pending |
| RESIL-04 | Phase 7 - Resilience and Stability | Pending |
| DEBUG-01 | Phase 6 - Telemetry UI | Pending |
| DEBUG-02 | Phase 2 - Bridge Core | Pending |
| DEBUG-03 | Phase 6 - Telemetry UI | Pending |

**Coverage:**
- v1 requirements: 18 total
- Mapped to phases: 18
- Unmapped: 0

---
*Requirements defined: 2026-02-25*
*Last updated: 2026-02-25 after roadmap creation — all 18 requirements mapped*
