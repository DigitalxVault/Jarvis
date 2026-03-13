# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-13)

**Core value:** Live telemetry from DCS appears on a web dashboard in under 500ms -- the pipeline works end-to-end and stays stable for a 20-minute flight session.
**Current focus:** v2.0 -- PWA + Responsive Layout + UI Amendments

## Current Position

Phase: 9 -- Font Size Overhaul (IN PROGRESS)
Plan: 01 of 3 complete
Status: In progress
Last activity: 2026-03-13 -- Completed 09-01-PLAN.md (DOM font size overhaul)

Progress: v1.0 [##########] 100% SHIPPED
Progress: v2.0 [###.......] 23% IN PROGRESS (Phase 8 complete, Phase 9 in progress)

## Performance Metrics

**Velocity:**
- Total plans completed: 22 (18 v1.0 MVP + 4 v2.0)
- Average duration: ~3 min (08-01), ~3 min (08-02), ~2.5 min (08-03), ~2 min (08-04)
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
| 8. PWA Foundation | v2.0 | 4 complete (DONE) |
| 9. Font Size Overhaul | v2.0 | -- |
| 10. Smart Connection Status | v2.0 | -- |
| 11. Collapsible Widgets | v2.0 | -- |
| 12. Draggable Layout | v2.0 | -- |
| 13. Responsive Layout | v2.0 | -- |
| 14. Offline Shell & Polish | v2.0 | -- |

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

08-03 decisions:
- D-831: No controllerchange listener -- fires on first install, would cause unwanted reload
- D-832: Offline page is standalone HTML/CSS -- no external deps (user is offline when it loads)
- D-833: UpdateBanner z-10000 (above scanline z-9999) -- must be visible and interactive

08-04 decisions:
- D-841: dismiss sets state to 'dismissed' (session-scoped, no localStorage) -- reappears on reload
- D-842: appinstalled listener cleanup in useEffect return -- prevents stale closures
- D-843: iOS detection uses Mac+ontouchend heuristic -- iPadOS 13+ reports as Mac UA
- D-844: Install prompt fixed at bottom, update banner at top -- no visual overlap

Amendment decisions (2026-03-13):
- D-901: Font sizes increased for in-flight readability -- Amendment 2
- D-902: Smart connection status replaces START SESSION / DEV MODE buttons -- Amendment 3 + 4a + 4c
- D-903: Collapsible widget panels for screen declutter -- Amendment 4d
- D-904: react-grid-layout for draggable widget layout with localStorage persistence -- Amendment 1

| ID | Decision | Outcome |
|----|----------|---------|
| D-801 | Separate maskable icon entry | 3 icon entries: 192/any, 512/any, 512/maskable |
| D-802 | theme_color = #010a1a not #00ffff | Dark OS chrome consistent with app background |
| D-803 | Sharp for icon generation | scripts/generate-icons.mjs, reproducible |
| D-821 | skipWaiting via message only | No mid-flight reload risk |
| D-822 | NavigationPreload in activate | Lower latency on navigate requests |
| D-823 | RSC: two-path detection | Prevents hydration errors |
| D-824 | sw.js no-cache headers | Browsers always fetch latest SW |
| D-831 | No controllerchange in UpdateBanner | Prevents reload on first SW install |
| D-832 | Offline page: zero external deps | Loads correctly when user is offline |
| D-833 | UpdateBanner z-10000 | Visible above scanline overlay |
| D-841 | Session-scoped dismiss (no localStorage) | Prompt reappears on reload; no persistence needed |
| D-842 | appinstalled cleanup in useEffect return | Prevents stale closures on unmount |
| D-843 | Mac+ontouchend iOS heuristic | Catches iPadOS 13+ which reports as Mac UA |
| D-844 | Install prompt at bottom, update banner at top | No visual overlap between banners |
| D-901 | Font sizes for in-flight readability | Amendment 2 — Phase 9 |
| D-902 | Smart connection status panel | Amendment 3 + 4a + 4c — Phase 10 |
| D-903 | Collapsible widget panels | Amendment 4d — Phase 11 |
| D-904 | react-grid-layout draggable layout | Amendment 1 — Phase 12 |

### Pending Todos

- Complete Phase 9 plans 02 and 03: Font Size Overhaul (canvas instruments + remaining)
- Plan Phase 10: Smart Connection Status
- Plan Phase 11: Collapsible Widgets
- Plan Phase 12: Draggable Layout
- Plan Phase 13: Responsive Layout (rewrite for react-grid-layout)
- Plan Phase 14: Offline Shell and Polish

### Blockers/Concerns

- NextAuth v5 session JWT structure may change between betas -- verify before next milestone
- Supabase free tier pauses projects after 1 week of inactivity; unpause manually or add keepalive
- Supabase RLS disabled -- must re-enable when addressing auth integration in future milestone
- iOS PWA limitations: no beforeinstallprompt (HANDLED via guidance UI in 08-04), 7-day storage eviction, limited background execution
- RSC payloads excluded from SW caching (RESOLVED in 08-02 via two-path detection)
- iOS WebSocket dies on background -- existing visibilitychange reconnection mitigates
- pnpm sharp resolution: script uses fallback path to virtual store (not symlinked at top-level)
- react-grid-layout compatibility with Next.js 16 / React 19 — needs research before Phase 12 planning

## Session Continuity

Last session: 2026-03-13T09:22:43Z
Stopped at: Completed 09-01-PLAN.md -- DOM font sizes increased for in-flight readability
Resume file: None -- continue with 09-02 and 09-03 plans
