# JARVIS DCS Prototype

## What This Is

A companion system for Digital Combat Simulator (DCS) that streams live gameplay telemetry from DCS through a local Node.js bridge to Supabase Realtime, then renders it on a JARVIS-themed web dashboard. v1.0 MVP proves the end-to-end connectivity pipeline works with session pairing, resilience, and stability.

## Core Value

Live telemetry from DCS appears on a web dashboard in under 500ms — the pipeline works end-to-end and stays stable for a 20-minute flight session.

## Current State

Shipped v1.0 MVP with ~1,847 LOC (TypeScript/TSX/Lua/CSS) across 65 files.
Tech stack: Next.js 16 (App Router), Supabase (Realtime + Postgres), NextAuth v5, Node.js bridge, DCS Export.lua.
Pipeline proven: DCS (10 Hz UDP) → bridge (2-5 Hz downsample) → Supabase Realtime → Web dashboard (<500ms).
Google OAuth placeholders configured but not yet tested with real credentials.
Supabase RLS disabled for prototype — re-enable when addressing auth integration.

## Requirements

### Validated

- DCS Export.lua sends telemetry packets at 10 Hz via UDP (IAS, ALT, HDG + position/attitude) — v1.0
- Local Node.js bridge receives UDP packets and forwards to Supabase Realtime — v1.0
- Web UI subscribes to Supabase Realtime channel and renders live telemetry — v1.0
- Connection status indicator (Connected / Reconnecting / Offline) — v1.0
- Telemetry cards display IAS, ALT, and HDG with live updates — v1.0
- Debug panel shows last packet time, packets/sec, session ID, subscription status — v1.0
- Google sign-in via NextAuth.js — v1.0
- Session pairing: web generates code, bridge authenticates with it — v1.0
- Bridge handles internet disconnection and auto-reconnects — v1.0
- Bridge handles DCS exporter stopping gracefully — v1.0
- Session scoping enforced (bridge can only publish to its paired session) — v1.0
- No memory growth or runaway logs in a 20-minute session — v1.0

### Active

(None — next milestone requirements TBD via `/gsd:new-milestone`)

### Out of Scope

- Training events / scoring / event feed — Phase 2
- Coaching engine / rule-based prompts — Phase 2
- DCS injection (outText, sounds, flags) — Phase 3
- Audio / JARVIS voice cues — Phase 3
- Instructor view / multi-session — Phase 4
- Multiplayer support — Phase 4
- Mobile / tablet responsive layout — future
- Standalone .exe packaging for bridge — future
- Mission scripting (gates, triggers) — Phase 2

## Context

- **DCS** is a PC flight simulator that exposes telemetry via Export.lua callbacks (LoGetSelfData, LoGetModelTime, etc.) over UDP on localhost.
- **dcs-jupyter** (in `.docs/dcs_jupyter-0.1.6/`) is a reference Python library that demonstrates DCS Lua-to-UDP communication patterns. We use it for protocol understanding, not as a dependency.
- **F-16C Viper** is the target aircraft module. LoGetSelfData() works universally across all modules but the F-16C is the primary test platform.
- Export.lua sends JSON-encoded telemetry to a localhost UDP port at 10 Hz.
- The bridge must run on the same Windows PC as DCS (UDP is localhost-only).
- The web dashboard is hosted on Vercel and cannot receive inbound connections from the gamer PC directly — hence the bridge-to-cloud relay architecture.
- Reference documents: `PRD.md` (full product vision), `JARVIS_DCS_Prototype_Test_Plan.md` (Phase 1 test cases D1-D6), `documents/DCS_Gameplay_Data_Export_Catalogue.md` (DCS data reference).

## Constraints

- **Tech stack**: Next.js (App Router) on Vercel, Supabase (Realtime + Postgres), NextAuth.js, Node.js bridge
- **Target platform**: DCS runs on Windows 10/11; bridge runs on same PC; web UI is desktop Chrome/Edge
- **Latency**: End-to-end < 500ms typical on local internet
- **Export rate**: 10 Hz from DCS (bridge may downsample for cloud publishing)
- **Free tiers**: Prototype must work within Supabase free tier and Vercel Hobby plan limits
- **No persistent bridge state**: Bridge is stateless between sessions; all state lives in Supabase
- **Security**: Pairing codes are short-lived (5 min), bridge publish permissions scoped to single session

## Key Decisions

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Supabase Realtime for telemetry push | Vercel lacks native pub/sub; Supabase bundles Realtime + Postgres + free tier | Good — works within free tier, <500ms latency achieved |
| Supabase Postgres for storage | Same platform as Realtime; one service to manage | Good — simple setup, sessions table works well |
| NextAuth.js over Supabase Auth | More flexible, native Next.js integration, not locked to Supabase for auth | Good — but requires RLS workaround (disabled for prototype) |
| Node.js bridge over Python | Same language ecosystem as web app; easier packaging; native async I/O | Good — shared types via monorepo, tsx runtime works well |
| Export.lua hook over mission scripting | Works with any mission; LoGetSelfData() is universal; no custom mission files needed | Good — dofile() chaining preserves TacView/SRS compatibility |
| F-16C Viper as target aircraft | Popular module with good export support; primary test platform | Pending — not yet tested on hardware |
| Desktop only | Pilot is at a PC; HUD layout optimized for wide screens; simplifies Phase 1 | Good — appropriate for prototype |
| Phase 1 scope only | Prove pipeline before adding scoring/coaching; clean separation of concerns | Good — pipeline proven, clean foundation for Phase 2 |
| Monorepo structure | Bridge + web app in single repo for easier development during prototype | Good — pnpm workspaces + shared types work smoothly |
| Port 7779 for JARVIS UDP | Avoids DCS internal port 12800 and TacView port 7778 | Good — no conflicts observed |
| Downsample 10 Hz to 2-5 Hz at bridge | Supabase free tier message budget constraint | Good — sufficient for dashboard updates |
| Disable Supabase RLS for Phase 1 | NextAuth + Supabase Auth incompatibility in prototype | Revisit — re-enable when addressing auth integration |
| AbortSignal.timeout(5000) for fetch | Prevent network hangs from blocking bridge indefinitely | Good — clean timeout behavior |
| Edge-triggered DCS silence detection | Fire once on transition, not every heartbeat tick | Good — reduces log noise |
| heartbeatCallback + worker: true | Prevent tab-throttle WebSocket drops | Good — maintains connection in background tabs |

---
*Last updated: 2026-02-25 after v1.0 milestone*
