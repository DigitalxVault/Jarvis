# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-02-25)

**Core value:** Live telemetry from DCS appears on a web dashboard in under 500ms — the pipeline works end-to-end and stays stable for a 20-minute flight session.
**Current focus:** Phase 7 - Resilience and Stability

## Current Position

Phase: 7 of 7 (Resilience and Stability)
Plan: 1 of 2 complete in current phase
Status: In progress — 07-01 complete, 07-02 in progress
Last activity: 2026-02-25 — Completed 07-01-PLAN.md (bridge resilience: backoff enforcement, 5s fetch timeout, memory logging, heap snapshots)

Progress: [█████████░] 93%

## Performance Metrics

**Velocity:**
- Total plans completed: 16 (Phases 1-6, built outside GSD tracking)
- Average duration: —
- Total execution time: — (not tracked, built outside GSD)

**By Phase:**

| Phase | Plans | Total | Avg/Plan |
|-------|-------|-------|----------|
| 1. Shared Foundation | 3 | — | — |
| 2. Bridge Core | 3 | — | — |
| 3. DCS Export.lua | 2 | — | — |
| 4. Web UI Foundation | 3 | — | — |
| 5. Session Pairing | 2 | — | — |
| 6. Telemetry UI | 3 | — | — |

**Recent Trend:**
- Last 5 plans: — (built outside GSD)
- Trend: —

*Updated after each plan completion*

## Accumulated Context

### Decisions

Decisions are logged in PROJECT.md Key Decisions table.
Recent decisions affecting current work:

- Roadmap: 7 phases derived from research sub-phases 1a-1g; phases 3 and 4 can be parallelised after phase 2 completes
- Architecture: Use port 7779 for JARVIS UDP (not 12800 which conflicts with DCS internals, not 7778 used by TacView)
- Architecture: Disable Supabase RLS for Phase 1 prototype; re-enable in Phase 2 (NextAuth + Supabase Auth incompatibility)
- Architecture: Downsample DCS 10 Hz → 2-5 Hz at bridge level (mandatory for Supabase free tier message budget)
- Sync: Phases 1-6 built outside GSD tracking, synced to GSD state on 2026-02-25. Telemetry flowing end-to-end confirmed.
- Bridge resilience (07-01): backoffUntilMs field guards publish loop during backoff window; prevents wasted fetch attempts after failures
- Bridge resilience (07-01): AbortSignal.timeout(5000) bounds all fetch calls so network hangs abort after 5s
- Bridge resilience (07-01): DCS silence detection is edge-triggered (wasDcsActive state machine) — fires once on transition, not every heartbeat tick
- Bridge resilience (07-01): lastUdpAt removed from metrics.ts; publisher.ts is single owner of UDP activity state
- Web resilience (07-02): heartbeatCallback detects silent Supabase disconnects; worker: true prevents tab-throttle WebSocket drops
- Web resilience (07-02): setupChannel callback deduplicates channel setup; visibility handler calls setupChannel on tab restore only
- Web resilience (07-02): Channel always removed before new one created — no duplicate channel accumulation

### Pending Todos

None yet.

### Blockers/Concerns

- Phase 5 (Session Pairing): NextAuth v5 session JWT structure may change between betas — confirm `auth()` returns expected user ID format before building the sessions table user_id binding
- General: Supabase free tier pauses projects after 1 week of inactivity; unpause manually between development sessions or consider a keepalive script

## Session Continuity

Last session: 2026-02-25
Stopped at: 07-01 complete (commits 3628ec7, e5c17da). 07-02 auto tasks also complete (commits 1e4c806, 5e63009), paused at checkpoint:human-verify (Task 3).
Resume file: .planning/phases/07-resilience-and-stability/07-02-PLAN.md (Task 3 continuation)
