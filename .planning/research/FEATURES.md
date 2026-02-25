# Feature Landscape: DCS Realtime Telemetry Companion Dashboard

**Domain:** DCS World flight telemetry companion / cockpit dashboard
**Researched:** 2026-02-25
**Scope:** Phase 1 prototype — pipeline validation, not full product

---

## Research Basis

Research drew from:
- DCS World Export.lua API documentation (Hoggit Wiki — HIGH confidence)
- TacView real-time telemetry documentation (official — HIGH confidence)
- DCS-BIOS documentation and GitHub (official — HIGH confidence)
- Helios Virtual Cockpit feature set (official — MEDIUM confidence)
- Squadron Debrief companion app (ED Forums — MEDIUM confidence)
- FlyStats DCS (GitHub + store listing — MEDIUM confidence)
- GStrain Bridge POC (DCS user files — MEDIUM confidence)
- RS Dash ASR (Play Store / App Store listing — MEDIUM confidence)
- SimHub DCS support thread (forum — MEDIUM confidence, notes: no DCS integration as of 2024)
- iRacing companion app (official — HIGH confidence, used as pattern reference)
- Community DCS Forum discussions on companion app wishlist (LOW confidence — directional only)

---

## What DCS Export.lua Actually Provides (Data Availability)

Confidence: HIGH (Hoggit Wiki, official DCS docs)

The following flight parameters are available via Export.lua callbacks for Phase 1:

| Parameter | Function | Notes |
|-----------|----------|-------|
| Indicated Airspeed | `LoGetIndicatedAirSpeed()` | Knots — core HUD metric |
| True Airspeed | `LoGetTrueAirSpeed()` | Useful for coaching later |
| Altitude (sea level) | `LoGetAltitudeAboveSeaLevel()` | Core HUD metric |
| Altitude (ground) | `LoGetAltitudeAboveGroundLevel()` | RADAR alt — later phases |
| Magnetic Heading | `LoGetMagneticYaw()` | Core HUD metric |
| Pitch / Bank / Yaw | `LoGetADIPitchBankYaw()` | Attitude data |
| Angle of Attack | `LoGetAngleOfAttack()` | Key coaching metric |
| G-Force | `LoGetAccelerationUnits()` | Coaching / strain later |
| Vertical Velocity | `LoGetVerticalVelocity()` | VSI |
| Mach Number | `LoGetMachNumber()` | High-speed awareness |
| Position (lat/lon) | `LoGetSelfData()` | Map use in later phases |
| Model Time | `LoGetModelTime()` | For session timing, debug |
| Pilot Name | `LoGetPilotName()` | Session identity |
| Engine Info | `LoGetEngineInfo()` | Throttle, RPM later |
| Slip Ball | `LoGetSlipBallPosition()` | Coordination |

Phase 1 uses only: IAS, ALT, HDG, model time, pilot name (for session pairing).

---

## Competitive Landscape Summary

### TacView Advanced
Post-flight + real-time 3D replay tool. Real-time telemetry is a feature (TacView Advanced tier). Streams position, altitude, heading, IAS, throttle, landing gear via TCP. Multiple clients can connect simultaneously. Heavy desktop app — not a lightweight companion. Does NOT provide connection health indicators or web-based access.

### DCS-BIOS
Hardware-first: connects Arduino control panels to DCS cockpit switches. Has a web interface for local network access. Provides per-aircraft cockpit state (every switch, gauge, display). Not a telemetry dashboard — it is a two-way hardware bridge. No cloud, no auth, no session concept.

### Helios Virtual Cockpit
Virtual cockpit panels on touchscreens. Profile-based (per-aircraft). Excellent for physical simpit builders. No cloud, no web access, no session concept. 2024 features: preflight check, interface status, control center console.

### Squadron Debrief
Post-flight logbook and Digital Flight Recorder. Records sortie data and replays on a map. Graphs (altitude, airspeed, vertical speed, attitude) are post-flight only. Offline-only — no cloud, no auth. Most feature-complete DCS companion for debrief use.

### FlyStats DCS
Post-match statistics from .acmi files (requires TacView). Scoreboard, missile stats, kill tracking. Cloud storage for registered users. NOT real-time. No connection pipeline.

### GStrain Bridge (POC)
Proof-of-concept UDP bridge: streams G telemetry in real-time, detects vocal strain from mic, delays G-LOC with telemetry-only mode. Closest in architecture to JARVIS. Does not have a web dashboard or cloud relay.

### SimHub
Full racing telemetry dashboard ecosystem. No DCS World support as of April 2024 (feature request open since 2020). Racing sim features (RPM, gear, lap times, tire temps) are not flight-applicable.

### iRacing Companion App
Schedule/stats companion — NOT real-time in-session telemetry. Shows profile, licenses, upcoming races. No live session data. Pattern reference only.

### RS Dash ASR (racing)
Real-time racing telemetry app with dashboard editor, cloud history, lap analysis. Best pattern reference for "what a session telemetry companion looks like at maturity."

---

## Table Stakes Features

Features users of any DCS companion app expect to work before they trust the product. For a PROTOTYPE, "users" are the developer validating the pipeline.

| Feature | Why Expected | Complexity | Phase 1? |
|---------|--------------|------------|----------|
| Live telemetry display (IAS / ALT / HDG) | Primary value prop — without this there is no product | Low | YES |
| Connection status indicator | Without this, users cannot tell if the app is working or broken | Low | YES |
| Data freshness signal | Stale data is worse than no data — users need to know when data stopped | Low | YES |
| Graceful handling of DCS stopping | DCS crashes / mission ends — app must not freeze or error | Low | YES |
| Auto-reconnect on internet drop | Wi-Fi blips kill sessions; silent reconnect is expected | Medium | YES |
| Session scoping (one pilot per session) | Multi-user relay must not bleed data between sessions | Medium | YES |
| Authentication (any form) | Cloud relay without auth is a security hole | Medium | YES (Google OAuth) |
| Bridge-to-session pairing | Establishes which bridge feeds which dashboard | Medium | YES |
| No memory leak / runaway log growth | 20-minute sessions must be stable | Low | YES |

**Note on "table stakes" for a prototype:** The bar is lower than for a shipped product. What matters is that the pipeline proves itself trustworthy. The IAS/ALT/HDG cards, the connection indicator, and the debug panel together ARE the proof of concept. If those three work stably, the prototype succeeds.

---

## Table Stakes NOT Required for Phase 1

These are standard in mature products but are out of scope for prototype validation:

| Feature | Why Eventually Expected | Why Not Phase 1 |
|---------|------------------------|-----------------|
| Moving map display | Community wishlist item #1 (DCS Forum) | Requires lat/lon rendering, map tiles — separate concern from pipeline |
| Post-flight replay / debriefing | Squadron Debrief, TacView do this | Not a realtime pipeline concern |
| Mobile / tablet support | Users fly at desktop | Adds responsive complexity; pipeline validation is desktop-first |
| Multiple aircraft support | DCS has many modules | F-16C is the target; Export.lua is universal |
| Per-aircraft cockpit switches | DCS-BIOS, Helios do this | Hardware-bridge concern, not telemetry dashboard |
| Event feed (weapons, kills) | Phase 2 in PRD | Requires event detection logic not yet built |
| G-force display | Available via LoGetAccelerationUnits() | Valuable but not minimum viable for pipeline proof |
| Angle of attack display | Key coaching metric | Phase 2 coaching feature |

---

## Differentiators

Features that would set JARVIS apart from existing DCS companion tools. None are Phase 1 concerns — they are the roadmap.

| Feature | Value Proposition | Complexity | Phase |
|---------|-------------------|------------|-------|
| Cloud relay via Supabase Realtime | No existing DCS tool does web-based realtime across internet | Medium | Phase 1 (foundation) |
| Coaching engine (rule-based prompts) | No DCS tool provides in-flight coaching; pilots self-debrief only | High | Phase 2 |
| AI-generated coaching (JARVIS voice) | Unique positioning — flight coach as AI assistant | Very High | Phase 3 |
| Instructor view (separate session) | TacView does this locally; no web-based instructor view exists | High | Phase 4 |
| DCS injection (messages, flags, sounds) | Bidirectional — few tools inject back into DCS from cloud | High | Phase 3 |
| Session history / flight logbook | Squadron Debrief does offline; JARVIS would do cloud-native | Medium | Post-Phase 1 |
| Scoring / grading per maneuver | No DCS tool grades maneuvers in realtime | High | Phase 2 |
| Multi-session squad view | No existing DCS companion shows multiple pilots simultaneously | Very High | Phase 4 |

The cloud relay architecture (DCS → UDP → bridge → Supabase → Next.js) is the core differentiator. Every existing tool is local-only or requires LAN access. JARVIS is the only approach that works from a different physical location.

---

## Anti-Features for Phase 1

Features to explicitly NOT build in Phase 1. Building them would add complexity without validating the core pipeline hypothesis.

| Anti-Feature | Why Avoid in Phase 1 | What to Do Instead |
|--------------|---------------------|-------------------|
| Dashboard editor / customization | RS Dash-style editors take weeks; pipeline validation needs none | Hard-code three cards |
| Per-aircraft profiles | Different cockpit data per module | Use universal LoGetSelfData() only |
| Post-flight replay | Not a realtime concern | Not in scope until Phase 2+ |
| Telemetry recording / logging | Storage schema and replay are separate features | Debug panel only; no persistence |
| Map display | Requires map tile service integration | Out of scope; lat/lon not displayed |
| Websocket from bridge direct to web | Tempting to skip cloud; breaks when pilot is behind NAT | Enforce the cloud relay pattern |
| Hardware integration (Arduino, etc.) | DCS-BIOS / Helios territory | Not this product |
| Multiple simultaneous sessions | Adds session management complexity | Enforce single active session per user |
| Push notifications | Mobile notifications require app or PWA service worker | Desktop-only for Phase 1 |
| Telemetry rate configurable by user | 10 Hz is fixed in DCS; bridge may downsample to 4-5 Hz for Supabase | Fixed rate, not user-configurable |
| Offline mode / local storage of telemetry | Adds IndexedDB or file I/O complexity | Live-only; no offline fallback |

---

## Feature Dependencies

```
Google Sign-In
    └── Session record in Supabase (users table)
        └── Pairing code generation (web → bridge)
            └── Bridge authentication with pairing code
                └── Session scoping (bridge publishes to session channel)
                    └── Web subscribes to session channel (Supabase Realtime)
                        └── Live telemetry cards (IAS / ALT / HDG)
                        └── Connection status indicator
                        └── Debug panel (packet rate, last packet time, session ID)

DCS Export.lua (10 Hz UDP)
    └── Node.js bridge receives UDP
        └── Bridge validates packet structure
            └── Bridge forwards to Supabase Realtime
                └── [feeds the subscription chain above]
```

Critical path: Auth → Pairing → Bridge Auth → Realtime subscription → Data display. Every item is a blocker for the next.

---

## Phase 1 MVP Feature Set

Minimum set that proves the end-to-end pipeline and constitutes a shippable prototype:

**Must Have (Phase 1 complete requires ALL of these):**
1. Google OAuth sign-in (NextAuth.js)
2. Session creation + pairing code generation (web side)
3. Bridge authenticates with pairing code, publishes to scoped Supabase channel
4. Supabase Realtime channel subscription (web side)
5. IAS card — live update at 4-5 Hz
6. ALT card — live update at 4-5 Hz
7. HDG card — live update at 4-5 Hz
8. Connection status indicator (Connected / Reconnecting / Offline)
9. Debug panel: packets/sec, last packet timestamp, session ID, subscription status
10. Bridge auto-reconnects on internet drop (with backoff)
11. Bridge handles DCS exporter stopping gracefully (no crash, shows stale)
12. 20-minute stability test passing (no memory growth, no runaway logs)

**Nice to Have (Phase 1 stretch, not blocking):**
- Mach number card
- G-force card
- Vertical speed indicator

**Explicitly Deferred:**
- All Phase 2-4 features listed in PRD

---

## Feature Complexity Notes

| Feature | Implementation Complexity | Risk |
|---------|--------------------------|------|
| Google OAuth (NextAuth.js) | Low — well-documented | Low |
| Supabase Realtime subscription | Low — standard pattern | Low |
| UDP receive in Node.js bridge | Low — dgram module | Low |
| Pairing code generation + validation | Medium — timing attack surface, expiry logic | Medium |
| Bridge session auth with Supabase | Medium — RLS policy design | Medium |
| Auto-reconnect with exponential backoff | Medium — state machine | Low |
| Stale data detection (DCS stopped) | Low — timestamp comparison | Low |
| Supabase free tier rate limits | Medium — 10 Hz may exceed free tier; must downsample | Medium |
| Debug panel (derived metrics) | Low — packet counter + timestamps | Low |
| Connection status state machine | Low — three states | Low |

The pairing code system and Supabase RLS policy for session-scoped publishing are the two areas with meaningful design risk in Phase 1.

---

## Sources

- [DCS World Export Functions — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export)
- [TacView Real-Time Telemetry Documentation](https://www.tacview.net/documentation/realtime/en/)
- [TacView Feature Comparison](https://www.tacview.net/features/comparison/en/)
- [DCS-BIOS Documentation](https://dcs-bios.readthedocs.io/en/latest/)
- [DCS-BIOS GitHub — DCS-Skunkworks](https://github.com/DCS-Skunkworks/dcs-bios)
- [Squadron Debrief — ED Forums](https://forum.dcs.world/topic/385703-squadron-debrief-flight-ops-companion-app-for-dcs-world-logbook-checklists-digital-flight-recorder/)
- [FlyStats DCS — GitHub](https://github.com/Dorvex/FlyStats-DCS-Public)
- [GStrain Bridge POC — DCS User Files](https://www.digitalcombatsimulator.com/en/files/3348681/)
- [DCS Companion Apps Community Thread](https://forum.dcs.world/topic/278361-dcs-companion-apps/)
- [Dashboard / Button Box Apps — ED Forums](https://forum.dcs.world/topic/278190-dashboardbutton-box-apps/)
- [Noobs Guide to Real-Time Telemetry from DCS](https://forum.dcs.world/topic/132361-noobs-guide-to-real-time-telemetry-from-dcs/)
- [SimHub DCS Support Status — Forum Thread](https://www.simhubdash.com/community-2/simhub/dcs-world/)
- [RS Dash ASR — Pocket Playground](https://www.pocketplayground.net/rs-dash)
