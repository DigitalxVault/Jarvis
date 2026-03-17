# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-03-14)

**Core value:** Live telemetry from DCS appears on a web dashboard in under 500ms -- the pipeline works end-to-end and stays stable for a 20-minute flight session.
**Current focus:** v3.0 Voice Co-Pilot & Trainer Platform — Phase 21 Trainer Session & Dashboard

## Current Position

Phase: 21 of 24 (Trainer Session & Dashboard) — In progress
Plan: 2 of 3 complete (21-02 done)
Status: In progress
Last activity: 2026-03-17 — Completed 21-02-PLAN.md (TSD integration into trainer dashboard)

Progress: v1.0 [##########] 100% SHIPPED
Progress: v2.0 [##########] 100% COMPLETE (Phases 8-14 all done)
Progress: v3.0 [######....] 50% Phase 21-02 complete

## Performance Metrics

**Velocity:**
- Total plans completed: 33 (18 v1.0 MVP + 15 v2.0)
- Average duration: ~3 min (08-01), ~3 min (08-02), ~2.5 min (08-03), ~2 min (08-04), ~3.5 min (09-02), ~6 min (09-03), ~3 min (10-02)
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
| 9. Font Size Overhaul | v2.0 | 3 complete (DONE) |
| 10. Smart Connection Status | v2.0 | 2 complete (DONE) |
| 11. Collapsible Widgets | v2.0 | 1 complete (DONE) |
| 12. Draggable Layout | v2.0 | 1 complete (DONE) |
| 13. Responsive Layout | v2.0 | 4 complete (DONE) |
| 14. Offline Shell & Polish | v2.0 | 3 complete (DONE) |
| 15. Python Bridge + DCS-gRPC | v3.0 | -- |
| 16. Session & Connection Overhaul | v3.0 | -- |
| 17. TTS Foundation + Voice Cues | v3.0 | -- |
| 18. Wake Word + STT Pipeline | v3.0 | -- |
| 19. Command Processing | v3.0 | -- |
| 20. Flight Phase & Proactive Alerts | v3.0 | -- |
| 21. Trainer Session & Dashboard | v3.0 | -- |
| 22. Trainer Communication | v3.0 | -- |
| 23. Trainer DCS Controls | v3.0 | -- |
| 24. Roles, Integration & Polish | v3.0 | -- |

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
| D-904 | Custom CSS transform drag layout (react-grid-layout rejected) | Amendment 1 — Phase 12 |
| D-921 | Y-offsets scaled to font metrics, not just size delta | Correct vertical spacing; no text overlap on canvas instruments |
| D-931 | Canvas radar scope Y-offsets bumped +2px at ring labels and diag strip | Prevents label clipping after 9→12px upgrade |
| D-932 | North indicator upgraded to bold 14px (from bold 11px) | Prominent cardinal reference at larger font size |
| D-1001 | hadTelemetryRef inside ConnectionStatusPanel for SYSTEM_INITIALIZED vs DCS_OFFLINE | Avoids polluting TelemetryContextValue; purely presentational distinction |
| D-1002 | DEV MODE removed entirely — no relocation | D-902 decision; single flow for pilots, no debug toggles in primary UI |
| D-1003 | animate-fade-in uses translateY(2px) + opacity | Matches slide-up pattern in globals.css; polished crossfade on state change |
| D-1004 | Top bar pill uses SYSTEM INIT (not SYSTEM INITIALIZED) | Panel handles hadTelemetry nuance; top bar is intentionally simpler |
| D-1005 | Spinning ring via absolute animate-spin border-t-jarvis-accent w-4 h-4 | Visual ring effect around static w-3 h-3 dot; only border-t colored |
| D-1006 | CompactCoaching early return pattern for non-live states | Clean state machine; no nested conditionals; !hasSession check before connectionState check |
| D-1201 | Custom CSS transform drag instead of react-grid-layout | RGL v2 ships full editor UI that broke JARVIS aesthetic; zero-dep custom approach |
| D-1202 | Dashboard dynamic import with ssr:false | React 19 hydration refuses to patch style attributes; client-only render avoids mismatch |
| D-1203 | localStorage lazy initializer in usePanelPositions | SSR-safe with typeof window check; positions loaded during client-side useState init |
| D-1301 | Tablet uses 3-column grid (not 2-column) | Same grid structure as desktop, scaled proportionally; REQ-220 updated to match design decision |
| D-1302 | Safe area as CSS utility classes (.safe-pt/pb/pl/pr) | Applied at component level for precision; not on body globally |
| D-1303 | Bottom bar fully hidden on mobile | LAT/LON/AGL and ticker non-essential on small screens; 50px reclaimed for instrument panels |
| D-1304 | Mobile strip: IAS/ALT/HDG/Mach only | Priority pilot data in 4 compact values; full mini cards too tall for phone |
| D-1305 | CSS-only for layout breakpoints, matchMedia for JS state only | Layout purely declarative; matchMedia only for editMode imperative clear |
| D-1306 | [data-panel-id] transform: none !important in CSS | Overrides inline drag transforms; cleaner than conditional JS logic |
| D-1307 | Canvas wrappers (div) use hidden sm:flex | Hides entire wrapper+margins; not just canvas child |
| D-1308 | Engine panel text fallback matches canvas PPH unit | Consistency between mobile/desktop views; plan suggested KG/H was incorrect |
| D-1309 | VVI text fallback uses inline 196.85 multiplier | Self-contained; avoids importing mpsToFpm for a single JSX expression |
| D-1401 | 2s debounce on recovery in useOnlineStatus | Prevents banner flicker during network flaps (mobile handoff, brief drops) |
| D-1402 | Offline detection immediate (no debounce) | Pilots need instant visual feedback when network is lost |
| D-1403 | No dismiss button on OfflineBanner | Flight safety requires persistent notification per CONTEXT.md |
| D-1404 | OfflineBanner z-[10001] above UpdateBanner z-[10000] | Network loss is higher priority than software update availability |
| D-1405 | Attempt counter increments every 5s via setInterval | Shows reconnection activity without overwhelming; matches staleness timeout scale |
| D-1406 | Fade-out at 1800ms, hidden at 2500ms after recovery | Smooth visual exit after connection restored |
| D-1421 | isOffline = isNetworkOffline || telemetry === null | Both network-down and initial null state show unpowered look; no brief flash of live data during ramp-up |
| D-1422 | Static chrome always visible when offline | Unpowered gauge aesthetic: frame/scale visible, needle gone; caution zones, ticks, arcs, outer ring, sky/ground all draw |
| D-1423 | NO DATA text at rgba(0, 212, 255, 0.15) opacity | Very faint — matches subdued unpowered palette; not a bright error indicator |
| D-1501 | type="cockpit" in minimal Lua | Clean split between UDP cockpit data and gRPC position/attitude/heading |
| D-1502 | bridge-py/generated/ gitignored | Generated files regenerated via gen_stubs.sh from committed protos |
| D-1503 | uv + hatchling for Python project | Fast installs, pinned Python 3.12.11, modern Python practices |
| D-1504 | Real DCS-gRPC protos from official repo | Accurate stubs for actual gRPC server API |
| D-1511 | StreamUnits on MissionService (not UnitService) | MissionService is the correct service per generated stubs |
| D-1512 | sys.path insert for generated/ at module level | Runtime path addition; stubs not packaged separately |
| D-1513 | max(grpc.t_model, cockpit.t_model) for packet timestamp | Uses fresher simulation clock value |
| D-1514 | Optional tas_mps/vvi_mps (None when zero) | Distinguishes "no data" from "actual zero velocity" |
| D-1505 | broadcast() raises; publish_telemetry() catches | Clean separation — raw broadcast usable by heartbeat; telemetry path handles all errors |
| D-1506 | flush_buffer() oldest-first, stop on first error | Preserves order; cleanly re-enters backoff on flush failure |
| D-1507 | Heartbeat swallows errors except CancelledError | Non-critical path; CancelledError must propagate for stop() to work correctly |
| D-1541 | _sync_normalizer 50ms poll copies state by assignment | Simple; no observer pattern needed at 4Hz |
| D-1542 | retry_count nonlocal int + getter closure for TUI | Clean encapsulation without coupling |
| D-1543 | JARVIS_LOCAL_DEV env var → localhost:3000 | Developer toggle without extra CLI flag |
| D-1544 | dotenv loads from bridge-py/.env and cwd both | Works from repo root (pnpm) and bridge-py/ dir |
| D-2101 | Trainer uses direct useTelemetry(sessionId), not context | Root providers in tree but trainer never consumes them |
| D-2102 | 4-digit numeric codes (1000-9999) distinct from pairing codes | Verbal-friendly; easy to read aloud |
| D-2103 | /api/trainer/claim requires no auth | Trainers have no accounts; code is their credential |
| D-2104 | Alert colors map ruleId → field label, not blanket severity | Specific fields highlight (pull_up→ALT, over_g→G-LOAD, etc.) |
| D-2105 | useCoaching always called; null smoothnessScore when no telemetry | React rules of hooks; null shows --- in Status card |
| D-2106 | rangeOptions defaults to DEFAULT_RANGE_OPTIONS; useState picks Math.floor(length/2) | Player gets 40nm default, trainer gets 10nm default |
| D-2107 | TrainerTSD: flex-1 min-h-0 min-w-0; center cell: flex flex-col min-h-0 | Canvas ResizeObserver sizes correctly; never collapses to 0px |
| D-2108 | Grid columns 280px 1fr 320px (was 1fr 260px for right) | Center gets dominant ~60% space; right slightly wider for Phase 21-03 logs |

### Pending Todos

**v2.0:** COMPLETE — all 49 requirements shipped (REQ-200 to REQ-248)

**v3.0 (in progress):**
- Phase 15: ALL 4 PLANS COMPLETE — awaiting human checkpoint verification
- Phase 21: Plan 21-01 COMPLETE — trainer code system + telemetry grid done
- Phase 21: Plan 21-02 COMPLETE — TSD integrated into trainer dashboard (rangeOptions prop + TrainerTSD)
- Phase 21: Plan 21-03 (Logs) pending
- Install DCS-gRPC mod in DCS World (required before Phase 15 testing)
- Set up API accounts: OpenAI, ElevenLabs, Picovoice (required before Phases 17-18)
- **Add `trainer_code` column to Supabase sessions table** (required before trainer API works)

### Blockers/Concerns

- NextAuth v5 session JWT structure may change between betas -- verify before next milestone
- Supabase free tier pauses projects after 1 week of inactivity; unpause manually or add keepalive
- Supabase RLS disabled -- must re-enable when addressing auth integration in future milestone
- iOS PWA limitations: no beforeinstallprompt (HANDLED via guidance UI in 08-04), 7-day storage eviction, limited background execution
- RSC payloads excluded from SW caching (RESOLVED in 08-02 via two-path detection)
- iOS WebSocket dies on background -- existing visibilitychange reconnection mitigates
- pnpm sharp resolution: script uses fallback path to virtual store (not symlinked at top-level)
- react-grid-layout v2 rejected — ships full editor UI that broke JARVIS aesthetic; custom CSS transform approach used instead (zero deps)
- DCS-gRPC mod not yet installed — required before Phase 15 development
- API keys not yet created: OpenAI (Whisper + GPT-4o), ElevenLabs (TTS), Picovoice (Porcupine) — required before Phases 17-18
- Python bridge replaces Node.js bridge — need migration plan for existing sessions/channels
- trainer_code column missing from sessions table — requires Supabase migration before Phase 21 APIs work
- TODO: rate-limit /api/trainer/claim (9000 possible codes, brute-force risk)

## Session Continuity

Last session: 2026-03-17
Stopped at: Completed 21-02-PLAN.md (TSD integration into trainer dashboard)
Resume file: None
