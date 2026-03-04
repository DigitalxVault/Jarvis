# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-04)

**Core value:** Live telemetry from DCS appears on a web dashboard in under 500ms -- the pipeline works end-to-end and stays stable for a 20-minute flight session.
**Current focus:** v2.0 -- PWA + Responsive Layout

## Current Position

Phase: 8 -- PWA Foundation
Plan: 2 of N (08-02 complete)
Status: In progress
Last activity: 2026-03-04 -- Completed 08-02-PLAN.md (Service Worker, SW Registration)

Progress: v1.0 [##########] 100% SHIPPED
Progress: v2.0 [##........] 20% IN PROGRESS

## Performance Metrics

**Velocity:**
- Total plans completed: 20 (18 v1.0 MVP + 2 v2.0)
- Average duration: ~3 min (08-01), ~3 min (08-02)
- Total execution time: 1 day (2026-02-25) + ongoing

**By Phase:**

| Phase | Milestone | Plans |
|-------|-----------|-------|
| 1. Shared Foundation | v1.0 | 3 |
| 2. Bridge Core | v1.0 | 3 |
| 3. DCS Export.lua | v1.0 | 2 |
| 4. Web UI Foundation | v1.0 | 3 |
| 5. Session Pairing | v1.0 | 2 |
| 6. Telemetry UI | v1.0 | 3 |
| 7. Resilience and Stability | v1.0 | 2 |
| 8. PWA Foundation | v2.0 | 2 complete |
| 9. Responsive Layout | v2.0 | -- |
| 10. Offline Shell & Polish | v2.0 | -- |

*Updated after each plan completion*

## Accumulated Context

### Decisions

All v1.0 decisions logged in PROJECT.md Key Decisions table with outcomes.

v2.0 research completed:
- Serwist vs manual SW: RESOLVED -- manual vanilla-JS SW chosen (08-02)
- Cache strategy: cache-first static, network-first HTML, network-only Supabase/API/RSC
- Update flow: prompt-to-refresh (never auto-reload during flight)
- WebSockets safe: SW cannot intercept WebSocket connections

08-01 decisions:
- D-801: Separate maskable icon entry (purpose: maskable) -- never combined "any maskable"
- D-802: theme_color: #010a1a (dark bg), not cyan accent -- OS chrome matches app dark theme
- D-803: Sharp SVG-to-PNG generation script -- reproducible, no new deps, uses existing sharp

08-02 decisions:
- D-821: skipWaiting only via SKIP_WAITING message -- prevents mid-flight reload
- D-822: NavigationPreload enabled -- reduces navigate latency while SW boots
- D-823: RSC excluded via _rsc param AND RSC/Next-Router-Prefetch headers -- two detection paths
- D-824: sw.js served no-cache via next.config.ts headers() -- browsers always revalidate

| ID | Decision | Outcome |
|----|----------|---------|
| D-801 | Separate maskable icon entry | 3 icon entries: 192/any, 512/any, 512/maskable |
| D-802 | theme_color = #010a1a not #00ffff | Dark OS chrome consistent with app background |
| D-803 | Sharp for icon generation | scripts/generate-icons.mjs, reproducible |
| D-821 | skipWaiting via message only | No mid-flight reload risk |
| D-822 | NavigationPreload in activate | Lower latency on navigate requests |
| D-823 | RSC: two-path detection | Prevents hydration errors |
| D-824 | sw.js no-cache headers | Browsers always fetch latest SW |

### Pending Todos

- Plan remaining Phase 8 plans (install prompt, update notification)
- Plan Phase 9: Responsive Layout

### Blockers/Concerns

- NextAuth v5 session JWT structure may change between betas -- verify before next milestone
- Supabase free tier pauses projects after 1 week of inactivity; unpause manually or add keepalive
- Supabase RLS disabled -- must re-enable when addressing auth integration in future milestone
- iOS PWA limitations: no beforeinstallprompt, 7-day storage eviction, limited background execution
- RSC payloads excluded from SW caching (RESOLVED in 08-02 via two-path detection)
- iOS WebSocket dies on background -- existing visibilitychange reconnection mitigates
- pnpm sharp resolution: script uses fallback path to virtual store (not symlinked at top-level)

## Session Continuity

Last session: 2026-03-04T09:42:05Z
Stopped at: Completed 08-02-PLAN.md
Resume file: None -- continue with next Phase 8 plan
