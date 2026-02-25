# Roadmap: JARVIS DCS Prototype

## Overview

JARVIS Phase 1 proves a single hypothesis: live flight telemetry from DCS World can travel through a local Node.js bridge, over the internet via Supabase Realtime, and appear on a web dashboard in under 500ms — and stay stable for a 20-minute session. The build order follows dependency direction: shared types first so neither bridge nor web drifts in isolation, bridge core second because it is the architecturally novel relay, DCS Lua and web UI in parallel once the relay is proven, session pairing to lock down security, telemetry UI to complete the visual layer, and resilience last to harden the proven pipeline against real failure modes.

## Phases

**Phase Numbering:**
- Integer phases (1, 2, 3): Planned milestone work
- Decimal phases (2.1, 2.2): Urgent insertions (marked with INSERTED)

- [x] **Phase 1: Shared Foundation** - Monorepo scaffold, shared TypeScript types, and Supabase project initialised
- [x] **Phase 2: Bridge Core** - UDP receiver, Supabase publisher, publish queue, and metrics logging operational
- [x] **Phase 3: DCS Export.lua** - Lua exporter running at 10 Hz with dofile() chaining, nil guards, and confirmed UDP delivery
- [x] **Phase 4: Web UI Foundation** - Next.js app with Google OAuth, Supabase client, and raw channel subscription logging events
- [x] **Phase 5: Session Pairing** - Pairing code flow end-to-end: web generates code, bridge claims it, channel scoping enforced
- [x] **Phase 6: Telemetry UI** - IAS/ALT/HDG cards, connection status indicator, debug panel, and JARVIS visual theme live
- [ ] **Phase 7: Resilience and Stability** - Bridge auto-reconnect, DCS staleness watchdog, tab visibility re-subscribe, and 20-minute session validation

## Phase Details

### Phase 1: Shared Foundation
**Goal**: The monorepo exists with a shared `TelemetryPacket` TypeScript type and a live Supabase project, so that both bridge and web can be built against the same contracts from the first commit.
**Depends on**: Nothing (first phase)
**Requirements**: None (infrastructure — unblocks all requirements)
**Test Cases**: None (prerequisite for D1-D6)
**Success Criteria** (what must be TRUE):
  1. `pnpm install` succeeds from the repo root and `packages/shared` is resolvable from both `packages/bridge` and `apps/web`
  2. `TelemetryPacket` TypeScript type and channel naming helpers are importable in both bridge and web without copy-paste
  3. Supabase project is initialised with a `sessions` table, Realtime enabled, and environment variables documented in `.env.example`
  4. A test broadcast message sent via Supabase dashboard appears in the JavaScript console of a browser subscribed to the channel
**Plans**: 3/3 complete

Plans:
- [x] 01-01: Initialise pnpm workspace monorepo with apps/web, packages/bridge, packages/shared directory structure
- [x] 01-02: Define TelemetryPacket type and channel naming helpers in packages/shared; configure TypeScript project references
- [x] 01-03: Create Supabase project, create sessions table schema, enable Realtime, document all required env vars in .env.example

---

### Phase 2: Bridge Core
**Goal**: The Node.js bridge can receive a UDP packet and publish it to a Supabase Realtime Broadcast channel — proven with synthetic test packets before DCS or pairing are involved.
**Depends on**: Phase 1
**Requirements**: CONN-02, DEBUG-02
**Test Cases**: D2 (rate/throttle verification)
**Note**: Phases 3 and 4 can begin in parallel once this phase is complete.
**Success Criteria** (what must be TRUE):
  1. Bridge receives a JSON UDP datagram on port 7779 and logs the parsed packet to console
  2. Bridge publishes a received packet to a hardcoded Supabase Broadcast channel and the event appears in the browser console within 500ms
  3. Bridge downsamples from 10 Hz UDP input to 2-5 Hz Supabase publishes — confirmed by counting log entries over 10 seconds
  4. Bridge logs pairing success/failure, receive packet count, publish success/failure with retry count, and queue size on every publish cycle
  5. Bridge does not crash when the UDP socket receives malformed JSON or an empty payload
**Plans**: 3/3 complete

Plans:
- [x] 02-01: Implement UDP receiver using node:dgram on port 7779 with JSON parse, recv buffer sizing, and error handling
- [x] 02-02: Implement Supabase Broadcast publisher with bounded publish queue (drop-oldest, max 100), 2-5 Hz downsampling, and retry logic
- [x] 02-03: Add metrics logging (packet count, publish count, queue size, last publish timestamp) and uncaughtException handler / PM2 config

---

### Phase 3: DCS Export.lua
**Goal**: DCS World sends telemetry packets at 10 Hz to the bridge over UDP, with the Lua exporter compatible with TacView/SRS/Helios via dofile() chaining and hardened against nil returns and Lua errors.
**Depends on**: Phase 2 (bridge must be running to receive packets)
**Requirements**: CONN-01
**Test Cases**: D2 (export rate confirmed), D3 (packet loss handling)
**Research flag**: Resolved — pure-Lua JSON encoder used (no dependency on DCS JSON.lua).
**Success Criteria** (what must be TRUE):
  1. DCS mission running with F-16C Viper produces UDP packets on port 7779 that appear in the bridge log at approximately 10 Hz
  2. IAS, ALT, and HDG values in the UDP packets are in SI units (m/s, metres, radians) as specified in the wire format — not already converted
  3. Disabling Export.lua and re-enabling it during a running DCS mission does not crash DCS or break the export chain for other tools (TacView/SRS compatibility)
  4. DCS mission restart or entering spectator mode does not crash the export chain (nil guard and pcall confirmed working)
**Plans**: 2/2 complete

Plans:
- [x] 03-01: Write jarvis_export.lua using LuaExportBeforeNextFrame + LoGetModelTime() gating, dofile() chaining pattern, pcall wrapping, and nil guard on LoGetSelfData()
- [x] 03-02: Validate JSON.lua path on target DCS installation; implement unit conversion wire format spec (m/s, m, radians); confirm measured packet rate at bridge matches 10 Hz target

---

### Phase 4: Web UI Foundation
**Goal**: A deployed Next.js app accepts Google sign-in and displays raw Supabase Broadcast events in the browser console — proving the authentication and subscription layers work before any UI components are built.
**Depends on**: Phase 2 (Supabase project and channel must exist)
**Requirements**: AUTH-01, AUTH-02, AUTH-03, CONN-03
**Test Cases**: D6 (auth/session scope — partial: sign-in and session creation)
**Note**: Can be built in parallel with Phase 3 after Phase 2 is complete.
**Success Criteria** (what must be TRUE):
  1. User can sign in with Google, and the session persists when the browser tab is refreshed
  2. Signed-in user can create a new session, and the session row appears in the Supabase `sessions` table with the correct user ID
  3. User can view a list of past sessions with timestamps, status (active/ended), and session ID
  4. Raw Supabase Broadcast events on the session channel appear in the browser console (confirming the subscription path works before UI components are added)
**Plans**: 3/3 complete

Plans:
- [x] 04-01: Scaffold Next.js 15 App Router project in apps/web; configure NextAuth.js v5 with Google provider; set AUTH_SECRET and all required Vercel env vars
- [x] 04-02: Implement /api/sessions POST route (create session, write to Supabase sessions table); implement session list page showing past sessions
- [x] 04-03: Implement Supabase client-side subscription in a Client Component; log raw broadcast events to console; confirm events arrive from bridge smoke test

---

### Phase 5: Session Pairing
**Goal**: The full pairing flow works end-to-end — web generates a short-lived code, bridge claims it and receives a scoped bridge token, and the bridge can only publish to its paired session channel.
**Depends on**: Phase 4 (auth and session creation must work)
**Requirements**: CONN-04, AUTH-02
**Test Cases**: D6 (session scoping enforced, no cross-session leakage)
**Success Criteria** (what must be TRUE):
  1. Authenticated user creates a session and a 6-character pairing code appears on screen and expires after 5 minutes
  2. Bridge authenticates with the pairing code via `/api/bridge/claim` and receives a `channelName` and `bridgeToken` scoped to that session
  3. Telemetry published by the bridge appears only on the paired session's channel — a second session's subscriber receives no packets from Bridge A
  4. A claimed pairing code cannot be reused — attempting to claim it a second time is rejected
**Plans**: 2/2 complete

Plans:
- [x] 05-01: Implement pairing code generation with 5-min TTL, 6-char code, DB-level UNIQUE constraint; display code on session creation page
- [x] 05-02: Implement /api/bridge/claim route; create bridge_tokens table; implement bridge claim.ts module; validate session scoping end-to-end (D6)

---

### Phase 6: Telemetry UI
**Goal**: The web dashboard renders live IAS, ALT, and HDG telemetry with a JARVIS HUD visual theme, a connection status indicator, and a debug panel — the complete visible prototype.
**Depends on**: Phase 5 (session pairing must work so real scoped telemetry flows)
**Requirements**: TELEM-01, TELEM-02, TELEM-03, TELEM-04, RESIL-01, DEBUG-01, DEBUG-03
**Test Cases**: D1 (full pipeline smoke test), D2 (rate/throttle verification)
**Success Criteria** (what must be TRUE):
  1. IAS card shows live indicated airspeed in knots, ALT card shows live altitude MSL in feet, and HDG card shows live heading in degrees — all updating at 4-5 Hz while DCS is flying
  2. Connection status indicator cycles through Connected, Reconnecting, and Offline states in response to actual bridge and DCS state changes
  3. Debug panel shows last packet time, smoothed packets/sec, current session ID, and Supabase subscription status — all updating live
  4. Raw packet viewer shows the last N telemetry packets as expandable JSON entries
  5. Dashboard uses JARVIS HUD visual theme: dark background, high-tech card styling, HUD-style typography
**Plans**: 3/3 complete

Plans:
- [x] 06-01: Implement TelemetryCard components (IAS/ALT/HDG) with correct unit display (knots/feet/degrees) and JARVIS theme using shadcn/ui + Tailwind CSS v4
- [x] 06-02: Implement ConnectionStatus component (4-state: Connected / DCS Offline / Reconnecting / Offline) driven by bridge heartbeat
- [x] 06-03: Implement DebugPanel (packets/sec smoothed, last packet timestamp, session ID, subscription status) and raw packet viewer (last N packets as expandable JSON)

---

### Phase 7: Resilience and Stability
**Goal**: The prototype passes all six test cases from the test plan and runs stably for 20 minutes without memory growth, runaway logs, or unrecoverable failure states.
**Depends on**: Phase 6 (full pipeline must be working to test failure modes)
**Requirements**: RESIL-02, RESIL-03, RESIL-04, DEBUG-02
**Test Cases**: D3 (packet loss), D4 (internet drop/reconnect), D5 (DCS stop), D6 (session scope — full validation)
**Success Criteria** (what must be TRUE):
  1. After a 30-second internet disconnection, telemetry resumes automatically within 10 seconds of reconnection, with no duplicate sessions created (D4)
  2. When DCS stops sending data, the bridge reports "No telemetry" status within 3 seconds and the dashboard shows DCS Offline (D5)
  3. When the browser tab is backgrounded and restored, the Supabase channel re-subscribes and telemetry resumes without a page refresh (RESIL-04)
  4. A 20-minute DCS flight session completes with no memory growth trend, no runaway log files, and all six test cases D1-D6 passing
**Plans**: 2 plans

Plans:
- [ ] 07-01-PLAN.md — Bridge resilience: enforce exponential backoff, add fetch timeout, fix DCS staleness watchdog, add memory instrumentation
- [ ] 07-02-PLAN.md — Web resilience: Supabase heartbeatCallback + worker config, deduplicate channel setup, tab visibility re-subscribe, stability checkpoint

---

## Progress

**Execution Order:** 1 -> 2 -> 3 (parallel with 4) -> 5 -> 6 -> 7

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Shared Foundation | 3/3 | Complete | 2026-02-25 |
| 2. Bridge Core | 3/3 | Complete | 2026-02-25 |
| 3. DCS Export.lua | 2/2 | Complete | 2026-02-25 |
| 4. Web UI Foundation | 3/3 | Complete | 2026-02-25 |
| 5. Session Pairing | 2/2 | Complete | 2026-02-25 |
| 6. Telemetry UI | 3/3 | Complete | 2026-02-25 |
| 7. Resilience and Stability | 0/2 | Planned | - |

**Parallelization note:** After Phase 2 is complete, Phase 3 (DCS Export.lua) and Phase 4 (Web UI Foundation) have no dependency on each other and can be worked in parallel.

---
*Roadmap created: 2026-02-25*
*Last updated: 2026-02-25 -- Phase 7 planned (2 plans in 1 wave)*
