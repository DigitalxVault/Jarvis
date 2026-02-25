# JARVIS DCS Prototype

## What This Is

A Phase 1 prototype of JARVIS, a companion system for Digital Combat Simulator (DCS) that streams live gameplay telemetry from DCS through a local bridge to a cloud relay, then renders it on a JARVIS-themed web dashboard. The prototype proves the end-to-end connectivity pipeline works before building scoring, coaching, and injection layers.

## Core Value

Live telemetry from DCS appears on a web dashboard in under 500ms — the pipeline works end-to-end and stays stable for a 20-minute flight session.

## Requirements

### Validated

(None yet — ship to validate)

### Active

- [ ] DCS Export.lua sends telemetry packets at 10 Hz via UDP (IAS, ALT, HDG + position/attitude)
- [ ] Local Node.js bridge receives UDP packets and forwards to Supabase Realtime
- [ ] Web UI subscribes to Supabase Realtime channel and renders live telemetry
- [ ] Connection status indicator (Connected / Reconnecting / Offline)
- [ ] Telemetry cards display IAS, ALT, and HDG with live updates
- [ ] Debug panel shows last packet time, packets/sec, session ID, subscription status
- [ ] Google sign-in via NextAuth.js
- [ ] Session pairing: web generates code, bridge authenticates with it
- [ ] Bridge handles internet disconnection and auto-reconnects
- [ ] Bridge handles DCS exporter stopping gracefully
- [ ] Session scoping enforced (bridge can only publish to its paired session)
- [ ] No memory growth or runaway logs in a 20-minute session

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
| Supabase Realtime for telemetry push | Vercel lacks native pub/sub; Supabase bundles Realtime + Postgres + free tier | -- Pending |
| Supabase Postgres for storage | Same platform as Realtime; one service to manage | -- Pending |
| NextAuth.js over Supabase Auth | More flexible, native Next.js integration, not locked to Supabase for auth | -- Pending |
| Node.js bridge over Python | Same language ecosystem as web app; easier packaging; native async I/O | -- Pending |
| Export.lua hook over mission scripting | Works with any mission; LoGetSelfData() is universal; no custom mission files needed | -- Pending |
| F-16C Viper as target aircraft | Popular module with good export support; primary test platform | -- Pending |
| Desktop only | Pilot is at a PC; HUD layout optimized for wide screens; simplifies Phase 1 | -- Pending |
| Phase 1 scope only | Prove pipeline before adding scoring/coaching; clean separation of concerns | -- Pending |
| Monorepo structure | Bridge + web app in single repo for easier development during prototype | -- Pending |

---
*Last updated: 2026-02-25 after initialization*
