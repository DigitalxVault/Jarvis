# Project Research Summary

**Project:** JARVIS DCS Companion — Realtime Telemetry Dashboard
**Domain:** Real-time game telemetry pipeline (local game process → cloud pub/sub → web UI)
**Researched:** 2026-02-25
**Confidence:** HIGH (stack and architecture verified against official sources; pitfalls community-validated)

---

## Executive Summary

JARVIS is a cloud-relay telemetry dashboard for DCS World — the first web-based companion that streams live flight data from a player's PC to a browser anywhere on the internet. No existing DCS tool does this. TacView, DCS-BIOS, Helios, and Squadron Debrief are all local-only or LAN-only. The core differentiator is the pipeline itself: `DCS Export.lua → UDP → Node.js bridge → Supabase Realtime Broadcast → Next.js dashboard`. Phase 1 is not a product launch — it is proof that this pipeline works end-to-end at 10 Hz with sub-500ms latency and survives a 20-minute flight session.

The recommended approach is a four-layer unidirectional telemetry pipeline with a bidirectional session management sideband. The hot path (DCS to browser) is fully async and stateless: DCS fires UDP datagrams, the bridge publishes to Supabase Broadcast, the browser receives WebSocket events. The control path (session creation, pairing code auth) runs through Supabase Postgres via Next.js API routes and governs channel access. This separation of concerns is the key architectural decision — it means the 10 Hz telemetry stream never touches the database, and the database never becomes a bottleneck.

The critical risks are concentrated at two points: the DCS Lua environment (Export.lua conflicts, nil guards, SI unit conversion, unreliable rate callbacks) and the Supabase free-tier message budget (must downsample from 10 Hz DCS output to 2–5 Hz for cloud relay to stay within limits). Both risks are fully understood and have known mitigations. Authentication introduces a third moderate risk: NextAuth.js and Supabase Auth are separate systems; RLS policies using `auth.uid()` will not work for NextAuth sessions unless bridged explicitly via service role key on server-side routes. Phase 1 resolves this by using service role key server-side only and disabling RLS during prototype.

---

## Key Findings

### Recommended Stack

The stack has strong consensus across all research threads. Every technology choice has HIGH confidence except NextAuth.js v5 (beta status, MEDIUM) and DCS JSON.lua availability (community-confirmed but not officially documented, MEDIUM). See `/Users/origene/1. MAGES STUDIO/DCS JARVIS/.planning/research/STACK.md` for full rationale with code samples.

**Core technologies:**

- **DCS Export.lua + LuaSocket 2.0 + JSON.lua**: DCS game-side telemetry extraction at 10 Hz — the only supported mechanism; UDP over localhost to bridge
- **Node.js 22.x (Maintenance LTS)**: Bridge runtime — ecosystem alignment with web app, native `fetch` built-in, `node:dgram` no external dependency, `tsx` for fast TS transpilation on Windows
- **Supabase Realtime Broadcast**: Cloud pub/sub relay — free tier sufficient (2M msg/month vs ~12K/session), 200 concurrent connections, <256 KB payload limit; Broadcast mode is correct (not Postgres Changes)
- **Supabase Postgres**: Session state, pairing codes, bridge tokens — not telemetry storage; free tier 500 MB is more than adequate
- **Next.js 15.x (App Router)**: Web dashboard — stable, well-documented, App Router mandatory for new projects; Realtime subscriptions must run in Client Components
- **NextAuth.js v5 beta**: Google OAuth — best App Router integration despite beta status; v4 lacks App Router support; env var prefix changed to `AUTH_`
- **shadcn/ui + Tailwind CSS v4**: UI components — copy-paste, no runtime overhead, full dark theme control; Tailwind v4 CSS-first config is stable and faster
- **Vercel Hobby**: Hosting — free tier, serverless functions, edge middleware; 10s function timeout not a concern for dashboard
- **pnpm workspaces**: Monorepo — share `TelemetryPacket` TypeScript type between bridge and web; no Turborepo needed for Phase 1

**Version constraints:**
- `@supabase/supabase-js` 2.97.x requires Node.js 20+ (Node 22 satisfies this)
- Do NOT use `@supabase/ssr` for Realtime client — it adds server-side cookie handling not needed for browser subscriptions
- Auth.js v5 uses `AUTH_SECRET` / `AUTH_URL` not `NEXTAUTH_SECRET` / `NEXTAUTH_URL`

---

### Expected Features

Phase 1 is pipeline validation, not product launch. The bar is: can IAS/ALT/HDG cards update live at 4–5 Hz in a browser while DCS is flying, stably, for 20 minutes? If yes, the pipeline is proven. See `/Users/origene/1. MAGES STUDIO/DCS JARVIS/.planning/research/FEATURES.md` for full competitive analysis.

**Must have — Phase 1 complete requires ALL of these:**
1. Google OAuth sign-in (NextAuth.js)
2. Session creation + pairing code generation (web side)
3. Bridge authenticates with pairing code, publishes to scoped Supabase channel
4. Supabase Realtime channel subscription (web side)
5. IAS card, ALT card, HDG card — live update at 4–5 Hz
6. Connection status indicator (Connected / Reconnecting / Offline / DCS Offline)
7. Debug panel: packets/sec, last packet timestamp, session ID, subscription status
8. Bridge auto-reconnects on internet drop (exponential backoff)
9. Bridge handles DCS stopping gracefully (staleness watchdog, no crash)
10. 20-minute stability test (no memory growth, no runaway logs)

**Phase 1 stretch (not blocking):**
- Mach number card, G-force card, vertical speed indicator

**Defer to Phase 2+:**
- Moving map, post-flight replay, coaching engine, per-aircraft profiles, mobile support, event feed

**The unique differentiator** — cloud relay via Supabase — is Phase 1's foundation. Every downstream phase (coaching, AI JARVIS voice, instructor view, multi-pilot squad) depends on this pipeline working reliably. Phases 2-4 add value on top; Phase 1 proves the foundation.

**Feature dependencies (critical path):**
```
Google Sign-In → Session record → Pairing code generation
    → Bridge auth with pairing code
        → Bridge publishes to session channel
            → Web subscribes to session channel
                → IAS/ALT/HDG cards, connection indicator, debug panel
DCS Export.lua (10 Hz UDP) → Node.js bridge → Supabase Realtime
```

---

### Architecture Approach

The system is a four-layer unidirectional telemetry pipeline with a bidirectional session management sideband. The pipeline flows DCS → Bridge → Supabase Broadcast → Browser. The sideband flows Browser → Supabase Postgres ← Bridge (for auth/pairing). These two flows are strictly separated: the hot path never touches the database. See `/Users/origene/1. MAGES STUDIO/DCS JARVIS/.planning/research/ARCHITECTURE.md` for full data flow, session pairing walkthrough, and code samples.

**Major components and responsibilities:**

| Component | Owns | Does NOT Own |
|-----------|------|-------------|
| Export.lua | Telemetry serialization (10 Hz), UDP send | Network auth, session state |
| Node.js Bridge | UDP receive, Supabase publish, reconnect, pairing claim | Web UI state, DCS simulation |
| Supabase Postgres | Sessions, pairing codes, bridge tokens, RLS | Telemetry relay, UI rendering |
| Supabase Realtime | WebSocket connections, ephemeral broadcast fan-out | Message persistence, business logic |
| Next.js Web UI | NextAuth session, Realtime subscription, display | Bridge process, DCS game state |

**Key patterns confirmed by research:**

1. **Stateless bridge with external state** — bridge holds no state between restarts; reclaims token on restart
2. **Publish queue with drop-oldest backpressure** — UDP ingest synchronous, Supabase publish async; decouple with bounded queue (max 100 packets)
3. **Heartbeat-based connection state machine** — 1 Hz bridge heartbeat carrying `{dcsActive, packetCount, queueSize}` lets browser distinguish 3 failure modes (bridge down, DCS silent, internet drop)
4. **Dedicated JARVIS UDP port** — use port 7779 (not 12800 which conflicts with DCS internals, not 7778 used by TacView)

**Session pairing security properties:** pairing code is single-use (invalidated on claim), 5-minute TTL, `service_role` key never leaves bridge `.env`, bridge publishes only to its claimed channel.

**Monorepo layout:**
```
apps/web/        # Next.js (Vercel)
packages/bridge/ # Node.js bridge (Windows)
packages/shared/ # TelemetryPacket + channel naming types
packages/bridge/dcs/Export.lua  # versioned alongside bridge
```

---

### Critical Pitfalls

22 domain-specific pitfalls catalogued across 8 categories. See `/Users/origene/1. MAGES STUDIO/DCS JARVIS/.planning/research/PITFALLS.md` for full detail with code samples. Top pitfalls with Phase 1 impact:

**CRITICAL severity — must be resolved before Phase 1 is usable:**

1. **Export.lua conflict with other DCS tools (PITFALL-DCS-1)** — DCS loads only one Export.lua; TacView/SRS/DCS-BIOS each replace it. Prevention: use `dofile()` chaining pattern, never standalone replacement. Must be in place before first test.

2. **LoGetSelfData() returns nil (PITFALL-DCS-4)** — nil return at mission loading, spectator mode, mission restart; unguarded access crashes the entire DCS export chain. Prevention: `if not selfData then return end` + wrap all export logic in `pcall()`.

3. **Supabase free tier: 10 Hz passthrough approach burns monthly quota (PITFALL-SUPABASE-1)** — at 10 Hz continuous the monthly 2M message limit is reachable; messages silently drop with no error. Prevention: downsample bridge → Supabase to 2–5 Hz. DCS → bridge stays 10 Hz. Not an optional optimization — implement from first commit.

4. **No WebSocket support on Vercel (PITFALL-VERCEL-1)** — architecture constraint, not a coding bug. The Supabase cloud relay is mandatory; any attempt to "optimize" by having bridge connect directly to Vercel will fail. Already correctly addressed by architecture; document it so it is never revisited.

5. **NEXTAUTH_SECRET missing in production (PITFALL-AUTH-1)** — without this env var set in Vercel, all user sessions fail silently. Must be set before first deployment; use `AUTH_SECRET` (v5 naming).

**HIGH severity — must be resolved in Phase 1 for stability:**

6. **LuaExportActivityNextEvent unreliable across DCS versions (PITFALL-DCS-3)** — rate breaks after DCS updates. Prevention: use `LuaExportBeforeNextFrame` with `LoGetModelTime()` manual gating instead.

7. **Supabase channel auto-reconnect does not always recover (PITFALL-SUPABASE-3)** — backgrounded tabs timeout; reconnect loop may get stuck. Prevention: Page Visibility API to force `removeAllChannels()` + re-subscribe on tab restore.

8. **NextAuth + Supabase RLS incompatibility (PITFALL-AUTH-2)** — `auth.uid()` is null for NextAuth sessions. Prevention: service role key server-side only; disable RLS for prototype; design for Phase 2 re-enablement.

9. **Bridge has no crash recovery on Windows (PITFALL-BRIDGE-2)** — unhandled exceptions leave bridge dead until manual restart. Prevention: PM2 process manager for Phase 1; `uncaughtException` handler minimum.

10. **Browser tab throttling kills WebSocket heartbeat (PITFALL-BROWSER-1)** — Chrome/Edge/Firefox throttle backgrounded tab timers; Supabase disconnects after 60s without heartbeat. Prevention: Page Visibility API disconnect/reconnect on tab hide/show.

---

## Implications for Roadmap

Based on combined research, the build order is dictated by dependency direction: nothing upstream can be tested without the layer below working. The pipeline flows DCS → Bridge → Supabase → Browser, but the build order is: shared types first, bridge core second, DCS Lua third, web UI fourth, pairing flow fifth, UI polish sixth, resilience last.

### Phase 1a: Shared Foundation
**Rationale:** TypeScript types used by both bridge and web must exist before either is built. Type drift between bridge and dashboard causes subtle runtime failures that are hard to diagnose. Monorepo scaffold and Supabase project setup are zero-dependency blockers.
**Delivers:** pnpm workspace, `packages/shared` with `TelemetryPacket` and channel naming helpers, Supabase project with `sessions` table and Realtime enabled
**From FEATURES.md:** Prerequisites for everything
**Pitfalls avoided:** PITFALL-SUPABASE-4 (channel naming consistency enforced at type level)
**Time estimate:** 2–4 hours
**Research flag:** None — standard patterns

### Phase 1b: Bridge Core
**Rationale:** The bridge is the critical relay and the only component that crosses the NAT boundary. Verifying it works before DCS is involved isolates the most architecturally novel piece. Smoke-test with netcat before touching DCS Lua.
**Delivers:** UDP receiver (dgram, localhost, JSON parse), Supabase publisher (channel join, broadcast send), publish queue with drop-oldest, basic reconnect, metrics logging
**From FEATURES.md:** Core pipeline (Features 3, 8 from must-have list)
**Pitfalls addressed:** PITFALL-UDP-1 (sequence check), PITFALL-UDP-2 (recv buffer size), PITFALL-SUPABASE-1 (downsampling to 2–5 Hz), PITFALL-BRIDGE-1 (ring buffer not packet history), PITFALL-BRIDGE-2 (PM2 or uncaughtException)
**Time estimate:** 1–2 days
**Research flag:** None — well-documented Node.js patterns

### Phase 1c: DCS Export.lua
**Rationale:** The DCS Lua environment is opaque and version-sensitive. Isolate and verify Export.lua separately from the bridge being built. The two most CRITICAL pitfalls (DCS-1 chaining, DCS-4 nil guard) must be resolved here before any integrated testing.
**Delivers:** `Export.lua` using `LuaExportBeforeNextFrame` + `LoGetModelTime()` gating at 10 Hz, proper `dofile()` chaining, pcall wrapping, unit-correct SI values in packet, verified UDP delivery to bridge
**From FEATURES.md:** The DCS data source for Features 5–7 (IAS/ALT/HDG cards)
**Pitfalls addressed:** PITFALL-DCS-1 (dofile chaining), PITFALL-DCS-2 (DCS vs DCS.openbeta path), PITFALL-DCS-3 (LuaExportBeforeNextFrame), PITFALL-DCS-4 (nil guard + pcall), PITFALL-DCS-5 (unit conversions documented in wire format spec), PITFALL-DCS-6 (string sanitization)
**Time estimate:** Half day; allow extra half day for DCS Lua environment debugging
**Research flag:** NEEDS EMPIRICAL VALIDATION — DCS JSON.lua path is MEDIUM confidence; test `Scripts/JSON.lua` vs `net.lua2json()` on the actual DCS installation

### Phase 1d: Web UI Foundation
**Rationale:** Build the Supabase subscription before building the telemetry UI. Verify raw events arrive in the browser console before rendering any components. NextAuth must come before any protected route.
**Delivers:** Next.js App Router scaffold, NextAuth.js Google OAuth, Supabase client, channel subscription (logs raw events), session creation API route (`/api/sessions`)
**From FEATURES.md:** Features 1–4 (auth, session, subscription)
**Pitfalls addressed:** PITFALL-AUTH-1 (AUTH_SECRET env var pre-deployment), PITFALL-AUTH-2 (service role pattern decided), PITFALL-VERCEL-1 (no WebSocket — architecture reinforced), PITFALL-VERCEL-2 (Fluid Compute enabled)
**Time estimate:** 1–2 days
**Research flag:** None — well-documented Next.js + NextAuth patterns

### Phase 1e: Session Pairing Flow
**Rationale:** Pairing is the pre-condition for authenticated, session-scoped publishing. Without it, bridge uses a hardcoded session ID (fine for smoke testing phases 1b–1d, not for the end-to-end test). Two known design risks: pairing code uniqueness (PITFALL-PAIRING-2) and timing attack surface (PITFALL-PAIRING-1).
**Delivers:** Pairing code generation with DB-level UNIQUE constraint, `/api/bridge/claim` route, `bridge_tokens` table, bridge `claim.ts` module, end-to-end test: pair bridge → bridge publishes to correct channel → dashboard receives
**From FEATURES.md:** Feature 3 (bridge-to-session pairing)
**Pitfalls addressed:** PITFALL-SUPABASE-4 (UUID channel names, not predictable names), PITFALL-PAIRING-1 (8-char codes, rate limiting), PITFALL-PAIRING-2 (DB UNIQUE constraint + retry)
**Time estimate:** Half day to 1 day
**Research flag:** None for pairing mechanism itself; MEDIUM confidence on RLS enablement timeline (defer to Phase 2 is confirmed correct)

### Phase 1f: Telemetry UI Components
**Rationale:** UI is the last layer — only meaningful once the pipeline is proven. Hard-code three cards; do not build a dashboard editor or customization system.
**Delivers:** `TelemetryCard` components (IAS, ALT, HDG with correct unit display), `ConnectionStatus` component (Connected/DCS Offline/Reconnecting/Offline), `DebugPanel` (packets/sec, last packet timestamp, session ID, subscription status)
**From FEATURES.md:** Features 5–9 (all display and status features)
**Pitfalls addressed:** PITFALL-DCS-5 (display in knots/feet/degrees not SI), PITFALL-BROWSER-2 (age indicator on stale data)
**Anti-features enforced:** No dashboard editor, no per-aircraft profiles, no map display, no offline mode
**Time estimate:** Half day to 1 day
**Research flag:** None — standard React + shadcn/ui patterns

### Phase 1g: Resilience and Stability
**Rationale:** A pipeline that works once is not the same as one that works for 20 minutes with an internet blip and a DCS crash. This phase makes the prototype pass its test plan.
**Delivers:** Bridge exponential backoff reconnect, publish queue overflow, bridge heartbeat (1 Hz `{dcsActive, packetCount, queueSize}`), DCS staleness watchdog (3s timeout → publish `dcs_offline`), bridge heap snapshot validation (0/5/20 min), Page Visibility API reconnect in dashboard, test cases D4 (internet drop) and D5 (DCS stop) passing
**From FEATURES.md:** Features 10–12 (auto-reconnect, graceful DCS stop, 20-min stability)
**Pitfalls addressed:** PITFALL-BRIDGE-3 (staleness watchdog), PITFALL-SUPABASE-3 (visibility API reconnect), PITFALL-BROWSER-1 (tab throttling), PITFALL-BRIDGE-1 (memory leak validation), PITFALL-UDP-2 (recv buffer size)
**Time estimate:** Half day
**Research flag:** None — patterns are standard; validation is empirical testing

---

### Phase Ordering Rationale

- Shared types first because TypeScript type drift between bridge and dashboard is a silent runtime failure that is hard to diagnose; the monorepo structure enforces correctness at compile time.
- Bridge before DCS because the DCS Lua environment is opaque; validate the network layer with synthetic packets before adding DCS as a variable.
- Bridge before web UI because the milestone "browser receives a fake packet via Supabase Realtime" (end of 1b + 1d) proves the core architecture hypothesis without DCS or pairing logic. If Supabase Broadcast latency or free tier limits are a problem, this is where you find out cheaply.
- DCS and web UI can be parallelized after bridge core is proven — Export.lua (1c) and web UI foundation (1d) have no dependency on each other.
- Pairing before UI polish because the integrated end-to-end test (pair → telemetry flows to dashboard) validates the security model before hardening the display.
- Resilience last because you need a working pipeline before you can meaningfully test it breaking and recovering.

---

### Research Flags

**Needs empirical testing before proceeding (do not assume):**
- **Phase 1c (Export.lua):** DCS JSON.lua path is MEDIUM confidence — test `loadfile([[Scripts\\JSON.lua]])()` vs `net.lua2json()` on the actual DCS installation. Have a pure-Lua fallback encoder ready.
- **Phase 1c (Export.lua):** `LuaExportBeforeNextFrame` rate gating — confirm actual measured packet rate at Node.js bridge matches 10 Hz target on the developer's PC with DCS frame rate variable.
- **Phase 1e (Pairing):** NextAuth v5 session JWT structure — test that `auth()` returns the expected user ID format for Supabase sessions table `user_id` column before building pairing.

**Standard patterns (research-phase not needed):**
- **Phase 1a (Foundation):** pnpm workspaces — well-documented, no unknowns.
- **Phase 1b (Bridge):** Node.js dgram + Supabase Broadcast — official docs verified; patterns are confirmed.
- **Phase 1d (Web UI):** Next.js 15 + NextAuth v5 + shadcn/ui — high-confidence; many reference implementations available.
- **Phase 1f (UI Components):** React state management at 4–5 Hz — well within React rendering budget; no research needed.

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All core technologies verified against official docs (Feb 2026). NextAuth v5 is MEDIUM (beta status, beta.30). DCS JSON.lua is MEDIUM (community-confirmed, not officially documented). |
| Features | HIGH | Data availability verified via Hoggit Wiki. Competitive landscape well-researched. Feature scope is minimal and validated against the pipeline-proof objective. |
| Architecture | HIGH | Component boundaries derived from confirmed Supabase constraints and DCS limitations. Session pairing pattern is standard device-pairing, well-understood. Build order validated against dependency graph. |
| Pitfalls | HIGH for DCS quirks (community-verified) + Supabase limits (official docs). MEDIUM for Node.js memory/process patterns (general knowledge + community reports). |

**Overall confidence: HIGH**

The research quality is unusually high for a prototype planning phase. The DCS community has documented Export.lua behavior extensively over 10+ years. Supabase limits and behavior are documented with official sources. The main unknowns are empirical (does JSON.lua exist at the path we expect; what is the actual measured packet rate on this machine) — these are fast to resolve during Phase 1c.

---

### Gaps to Address

1. **DCS JSON.lua path on this specific installation** — MEDIUM confidence that `Scripts/JSON.lua` exists. Resolve in Phase 1c: test `loadfile` path; have `net.lua2json()` fallback ready; consider bundling a minimal pure-Lua JSON encoder alongside `jarvis_export.lua` as a deterministic solution.

2. **Supabase free tier pausing** — Supabase free tier pauses projects after 1 week of inactivity. During active development this is not an issue, but between development sessions the project may require manual unpause. Consider upgrading to Pro ($25/month) if pausing becomes friction, or script a daily keepalive.

3. **NextAuth v5 session JWT format** — v5 is beta.30; JWT structure may change between betas. Confirm the session object shape before building the `sessions` table `user_id` binding. Check `authjs.dev` migration guide for the beta-to-stable path.

4. **UDP port 7779 availability** — document the JARVIS port choice; verify it does not conflict with other tools in the developer's DCS installation. Port 12800 (STACK.md initial suggestion) conflicts with DCS internals — confirmed in both STACK.md and PITFALLS.md to use a different port. ARCHITECTURE.md recommends 7779; STACK.md mentions 12810 or 42069. Settle on one port before Phase 1b.

5. **Browser Realtime subscription recovery completeness** — PITFALL-SUPABASE-3 notes that auto-reconnect may not always recover in all `supabase-js` versions. Phase 1g must include explicit testing of the Visibility API reconnect path, not just assume it works.

---

## Sources

### Primary (HIGH confidence — official documentation, verified Feb 2026)

- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast) — broadcast API, limits, pricing
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits) — free tier caps (2M msg/month, 100 msg/sec, 256 KB)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization) — RLS policy patterns
- [Node.js dgram Documentation](https://nodejs.org/api/dgram.html) — UDP socket API
- [Node.js Releases](https://nodejs.org/en/about/previous-releases) — Node 22 Maintenance LTS status
- [DCS Export Script — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_Export_Script) — LoGet* functions, callbacks
- [DCS Export — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export) — Export.lua lifecycle
- [Next.js 15 Release](https://nextjs.org/blog/next-15) — stable release, App Router
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4) — CSS-first config, stable Jan 2025
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4) — v4 compatibility
- [Vercel WebSocket Support](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections) — no WebSocket constraint confirmed
- [Vercel Functions Limits](https://vercel.com/docs/functions/limitations) — body size, timeout limits

### Secondary (MEDIUM confidence — community consensus, multiple sources agree)

- [Auth.js Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5) — NextAuth v5 beta patterns
- [jboecker/dcs-witchcraft Export.lua pattern](https://github.com/jboecker/dcs-witchcraft/blob/master/WitchcraftExport.lua) — dofile chaining, JSON.lua
- [jboecker/dcs-export-core Protocol.lua](https://github.com/jboecker/dcs-export-core/blob/master/DcsExportCore/Protocol.lua) — UDP bridge pattern
- [Helios Virtual Cockpit GitHub](https://github.com/HeliosVirtualCockpit/Helios/issues/288) — LuaExportActivityNextEvent reliability
- [Supabase Realtime background disconnect — realtime-js #121](https://github.com/supabase/realtime-js/issues/121) — tab throttling reconnect issue
- [DCS-ExportScripts Documentation](https://github.com/s-d-a/DCS-ExportScripts/wiki/Documentation-in-English) — Export.lua conflict resolution

### Tertiary (LOW confidence — forum discussions, directional only)

- [DCS Companion Apps Community Thread](https://forum.dcs.world/topic/278361-dcs-companion-apps/) — community feature wishlist
- [Export.lua Conflicts — ED Forums](https://forum.dcs.world/topic/252820-exportlua-conflicts/) — conflict patterns
- [Stable vs Open Beta folder structure — ED Forums](https://forum.dcs.world/topic/343996-installation-stable-vs-open-beta-folders-structure-in-saved-games/) — DCS path variants
- [GStrain Bridge POC — DCS User Files](https://www.digitalcombatsimulator.com/en/files/3348681/) — closest prior art to JARVIS architecture

---

## Stack Consensus

All four research threads agree on every major technology choice with zero conflicts:

| Decision | Consensus | Confidence |
|----------|-----------|-----------|
| UDP as DCS→Bridge transport | All agree: fire-and-forget, no handshake overhead | HIGH |
| Supabase Realtime Broadcast (not Postgres Changes) | All agree: Postgres is too slow for 10 Hz | HIGH |
| Node.js (not Python/Rust/Bun) | All agree: ecosystem alignment with web app | HIGH |
| pnpm workspaces monorepo | All agree: shared TelemetryPacket type is critical | HIGH |
| Session channel naming: `session:{uuid}` | All agree: security + isolation | HIGH |
| REST API vs WebSocket for bridge→Supabase | Mild divergence: STACK.md recommends REST for simplicity; ARCHITECTURE.md recommends WebSocket for latency. Resolution: use REST for Phase 1 (simpler reconnect logic), switch to WebSocket in Phase 1b+ if latency is measured as a concern | MEDIUM |
| Downsample DCS 10 Hz → 2–5 Hz for Supabase | All agree: mandatory for free tier | HIGH |
| service_role key on bridge only | All agree: never in browser bundle | HIGH |
| Disable RLS for Phase 1 prototype | All agree: re-enable in Phase 2 | HIGH |

**One open decision to settle before Phase 1b:** UDP port number. STACK.md mentions 12800 (but flags it conflicts with DCS), then suggests 12810 or 42069. ARCHITECTURE.md recommends 7779. PITFALLS.md confirms 12800 conflicts. Recommend: use **7779** as the canonical JARVIS port; document it as configurable.

---

*Research completed: 2026-02-25*
*Ready for roadmap: yes*
