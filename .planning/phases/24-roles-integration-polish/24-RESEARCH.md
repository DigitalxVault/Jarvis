# Phase 24: Roles, Integration & Polish - Research

**Researched:** 2026-03-18
**Domain:** React/Next.js integration auditing, error handling patterns, session lifecycle, memory leak detection
**Confidence:** HIGH

---

## Summary

Phase 24 is a polish and integration phase — no new external dependencies needed. All building blocks exist from Phases 21-23. The work is: audit Phases 21-23 code for memory leaks and missing error paths, add trainer session lifecycle UX (session-ended overlay + trainer rejoin flow), harden specific error paths (mic permission denial, TTS failure, command timeouts), and apply cosmetic loading states.

**Observer role (REQ-344) is explicitly dropped** per CONTEXT.md. This phase has exactly two plans: (1) session lifecycle UX + "Session Ended" overlay for the trainer, (2) memory leak audit + error handling hardening across all trainer hooks and components.

**Primary recommendation:** Start with plan 24-01 (session lifecycle) because it requires a new API endpoint (`PATCH /api/sessions/:id` to mark `status: 'ended'`) and a new Supabase broadcast event (`session_ended`). Plan 24-02 (audit + polish) is pure code review and targeted edits — no new dependencies, no schema changes.

---

## What Was Built in Phases 21-23

All code exists and is already wired. Phase 24 has nothing to implement from scratch except:

1. Session-ending flow (player can end session → trainer notified)
2. Trainer rejoin after disconnect (same code, same session)
3. Specific error message improvements (service-named errors)
4. Memory leak fixes where found

### Trainer Dashboard Architecture (confirmed by code inspection)

```
TrainerPage (app/trainer/page.tsx)
├── TrainerEntry       — code input, calls /api/trainer/claim
└── TrainerDashboard   — mounted when sessionId known
    ├── useTelemetry(sessionId)          — own subscription (not context)
    ├── useAlertConfig(sessionId)        — listens for config_alert broadcasts
    ├── useAlerts(telemetry, configRules)
    ├── useFlightPhase(telemetry)
    ├── useCoaching(telemetry)
    ├── useTrainerLog(sessionId, ...)    — own channel for 'conversation' events
    ├── ToastProvider                   — fixed bottom-right, 4s dismiss, max 3
    ├── TrainerTelemetryGrid
    ├── TrainerTSD → RadarScope (onCanvasClick support)
    ├── TrainerLogPanel
    └── TrainerCommPanel (4-tab: COMMS/CONTROLS/ALERTS/MISSION)
        ├── useTrainerComm               — PTT pipeline (getUserMedia, Whisper, rephrase, TTS)
        ├── useDcsCommands(sessionId)    — command correlation with 10s timeout
        ├── TrainerControlsTab          — spawn presets + custom form + Set AI Objective
        ├── TrainerAlertsTab            — 7-rule config, broadcasts config_alert
        └── TrainerMissionTab           — Quick Inject + Route Builder + TSD click-to-place
```

### Supabase Channel Usage (confirmed by code inspection)

All trainer-side hooks open their own channels on `session:{sessionId}`. Supabase JS creates distinct channel objects per `supabase.channel()` call even when the channel name is the same — so multiple subscriptions to the same name is intentional and correct.

| Hook/Component | Channel | Events listened | Events sent | Cleanup |
|---|---|---|---|---|
| `useTelemetry` | `session:{id}` | telemetry, heartbeat, tactical | — | `supabase.removeChannel` in return |
| `useDcsCommands` | `session:{id}` | dcs_command_result | dcs_command | `supabase.removeChannel` in return |
| `useTrainerLog` | `session:{id}` | conversation | — | `supabase.removeChannel` in return |
| `useAlertConfig` | `session:{id}` | config_alert | — | `supabase.removeChannel` in return |
| `TrainerAlertsTab` | `session:{id}` | — | config_alert | `supabase.removeChannel` in return |
| `useTrainerComm.sendText` | `session:{id}` | — | conversation | NOT cleaned up — creates a new channel per send |

**Memory leak found:** `useTrainerComm.sendText` creates a new `supabase.channel()` on every call and never removes it. This is a genuine leak in a 30-minute session.

---

## Standard Stack

No new libraries needed. All existing dependencies are used.

### Core (already installed)
| Library | Version | Relevant Usage |
|---------|---------|----------------|
| `@supabase/supabase-js` | existing | Realtime channels, DB REST |
| `next` | 16 | API routes for session end, app router |
| `react` | 19 | Hooks, context, state |

### Supporting patterns already established
| Pattern | Where | Used For |
|---------|-------|---------|
| `ToastProvider` + `useToast` | `toast-notification.tsx` | Error feedback (already wired in TrainerDashboard) |
| `ConfirmModal` | `confirm-modal.tsx` | Destructive action confirmations |
| Supabase broadcast | all trainer hooks | Channel events |

---

## Architecture Patterns

### Pattern 1: Session-Ended Detection (needs to be built)

**Problem:** Player ends session → trainer has no way to know. Trainer sees `connectionState` go from `connected` → `dcs_offline` (DCS goes quiet) but the session row stays `active`. Trainer cannot distinguish "player paused DCS" from "player ended session".

**Recommended approach:** Broadcast-based notification.
1. Player dashboard gains an "End Session" button (or session end happens on page close)
2. On click: `PATCH /api/sessions/:id` sets `status: 'ended'`, then broadcast `session_ended` on the channel
3. Trainer `useTelemetry` (or a new lightweight hook) listens for the `session_ended` event
4. Trainer page shows a "SESSION ENDED" overlay with "Return to Join Screen" button

**Why broadcast, not DB polling:** The trainer already has an open Supabase channel. Broadcasting `session_ended` gives instant notification without extra polling. The PATCH to DB is still needed so `/api/trainer/claim` returns 404 for ended sessions (already checks `status = 'active'`).

**Where to put the listener:** Either extend `useTelemetry` to emit a `sessionEnded` boolean, or a thin separate hook. Given `useTelemetry` already owns the channel, extending it is cleaner.

**"Session Ended" overlay:** Full-screen overlay above the trainer dashboard (z-index above all content). JARVIS style, dark panel, session ID shown, "RETURN TO JOIN SCREEN" button that calls `onExit()` to reset `TrainerPage` state back to `entry`.

**Trainer rejoin:** Per CONTEXT.md, trainer can rejoin with the same 4-digit code as long as the session is active. This already works — `TrainerPage` is stateless about session persistence. When trainer returns to entry screen and re-submits the code, it works. The "Return to Join Screen" button just needs to reset `sessionId` and `state` back to `entry`.

### Pattern 2: Service-Named Error Messages

**What:** Replace generic error strings with specific service names.

Per CONTEXT.md:
- `"TTS unavailable"` — when `/api/tts` returns non-200
- `"Transcription failed"` — when `/api/whisper` returns non-200
- Mic permission denial → tooltip on PTT button (button stays visible but disabled)

**Where changes are needed:**
- `useTrainerComm.sendText`: catches `err.message === 'Rephrase failed'` → becomes `"Rephrase unavailable (GPT-4o)"`
- `useTrainerComm.sendText`: ElevenLabs failure → currently `speakWithElevenLabs` logs but doesn't throw → needs to reject on `/api/tts` failure → becomes `"TTS unavailable (ElevenLabs)"`
- `useTrainerComm.processVoice`: `'Transcription failed'` string → `"Transcription failed (Whisper)"`
- `useTrainerComm.toggleRecording`: mic permission denied (`NotAllowedError`) → currently sets error message correctly, but should be shown as a tooltip on the PTT button, not just an error state that auto-clears in 3s

**Mic permission tooltip:** Add a `micDenied` state to `TrainerVoiceTab`. When `stage === 'error'` and `errorMessage` contains "denied", show a persistent tooltip near the PTT button instead of the auto-clearing error message.

### Pattern 3: Memory Leak Audit

**High-priority leak: `useTrainerComm.sendText` channel not cleaned up**

```typescript
// Current code in sendText (line ~128):
const channel = supabase.channel(channelName)
channel.send(...)
// channel is NEVER removed — creates a new channel per send
```

Fix: reuse a persistent channel ref (same pattern as `useDcsCommands` and `useAlertConfig`). The channel for broadcasts in `sendText` only needs to exist for the lifetime of the hook, not per-send.

**Lower-priority patterns to audit:**

| Pattern | Files | Risk |
|---------|-------|------|
| RAF loops | `trainer-voice-tab.tsx` (waveform), `radar-scope.tsx` | RAF loop cancellation on component unmount |
| setInterval | `use-telemetry.ts` (PPS counter, staleness check), `top-bar.tsx` (clock) | Already cleaned up with return () => clearInterval |
| AudioContext | `use-trainer-comm.ts` (recording), `elevenlabs.ts` (shared ctx) | `audioCtxRef.current?.close()` called in cleanup — OK |
| MediaRecorder | `use-trainer-comm.ts` | `.stop()` called in cleanup — OK |
| Event listeners | `trainer-voice-tab.tsx` (keydown Space), `trainer-comm-panel.tsx` (mousedown outside) | Already cleaned up |

**`jarvis-voice-provider.tsx` broadcast pattern:** Also uses `supabase.channel()` without removing it, for `broadcastConversation`. Same issue as `useTrainerComm.sendText`. This is in the player-side provider, not the trainer, but still leaks.

### Pattern 4: Loading States

**Where loading states are missing or weak:**
1. `TrainerEntry` — submitting state already shows "CONNECTING..." ✓
2. `useDcsCommands` — `sendCommand` in CONTROLS tab shows `sending` state ✓
3. TTS pipeline in `useTrainerComm` — stages `transcribing`, `rephrasing`, `speaking` shown in `TrainerVoiceTab` ✓
4. **Missing:** When trainer page first loads after code entry, there's no loading indicator before telemetry arrives. `connectionState === 'connecting'` exists but the dashboard renders immediately with empty data. A subtle "AWAITING TELEMETRY..." banner during `connecting` state would improve UX.

### Pattern 5: Cosmetic Polish Items

From code inspection, these are candidates:
1. **TSD during connecting state:** TSD renders with empty canvas when `telemetry === null`. A "AWAITING PLAYER POSITION" overlay on the canvas center would be clear.
2. **Log panel empty state:** When `entries.length === 0`, show a dim "NO EVENTS YET" placeholder rather than blank space.
3. **TrainerControlsTab "AWAITING PLAYER POSITION" message:** Already implemented for non-absolute position modes ✓
4. **ToastProvider position:** Currently bottom-right at `z-9999`. Given the trainer dashboard fills the screen, ensure the toast doesn't overlap the log panel or TSD.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Toast notifications | Custom toast | `ToastProvider` + `useToast` (already exists) | Already wired in TrainerDashboard |
| Confirm dialogs | Custom modal | `ConfirmModal` (already exists) | Established pattern from Phase 23 |
| Supabase channel cleanup | Custom ref tracking | Follow the `useEffect` + `supabase.removeChannel(channel)` return pattern | Already used correctly in most hooks |
| Session ended DB update | Raw Supabase client call | `PATCH /api/sessions/:id` API route | Auth check needed |

---

## Common Pitfalls

### Pitfall 1: Supabase channel created per-call without cleanup

**What goes wrong:** Each call to `supabase.channel(channelName)` creates a new JS object subscribed to the same channel. Without `supabase.removeChannel()`, these accumulate. In a 30-minute trainer session, `sendText` might be called 50+ times.

**How to avoid:** Persist the broadcast channel in a `useRef`, create it once in `useEffect`, remove it in cleanup.

**Specific fix for `useTrainerComm.sendText`:**
```typescript
// In useTrainerComm hook setup effect (alongside sessionIdRef updates):
const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

useEffect(() => {
  const channelName = getChannelName(sessionId)
  const ch = supabase.channel(channelName, { config: { broadcast: { ack: false } } })
  ch.subscribe()
  broadcastChannelRef.current = ch
  return () => {
    supabase.removeChannel(ch)
    broadcastChannelRef.current = null
  }
}, [sessionId])

// In sendText, replace the new channel creation with:
const channel = broadcastChannelRef.current
if (!channel) throw new Error('Channel not ready')
channel.send(...)
```

**Same fix for `jarvis-voice-provider.tsx` `broadcastConversation`:** The `broadcastConversation` callback creates a new channel per call. Should use a persistent channel ref instead.

### Pitfall 2: Session-ended event not listened to before `useTelemetry` effect cleanup

**What goes wrong:** If the trainer listens for `session_ended` inside `useTelemetry`'s existing channel (reusing the same subscription), the listener is registered correctly. But if a new separate channel is opened for just this purpose, it adds yet another Supabase subscription.

**How to avoid:** Extend `useTelemetry` to handle `session_ended` broadcast events since it already manages the channel. Add a `sessionEnded` boolean to the returned state.

### Pitfall 3: "Session Ended" overlay blocks React state reset

**What goes wrong:** If the overlay calls `onExit()` which sets `sessionId = null` in the parent, `TrainerDashboard` unmounts. All cleanup runs correctly. But if any async operations (e.g. a `sendCommand` in flight) reject mid-unmount, the `pending.reject(new Error('Component unmounted'))` in `useDcsCommands` fires — this is already handled ✓.

**How to avoid:** The pattern is already correct. `useDcsCommands` cleans up all pending commands on unmount.

### Pitfall 4: `useEffect` re-run when `appendEntry` identity changes in `useTrainerLog`

**What goes wrong:** `appendEntry` is defined with `useCallback([], [])` but it uses `setEntries` which is stable — so this is actually fine. The concern is that `useEffect` deps arrays that include `appendEntry` will re-run when `appendEntry` changes, but since `appendEntry` has empty deps, it's stable.

**Status:** Not a real issue in current code — `appendEntry` is correctly stable.

---

## Code Examples

### Session-ended broadcast pattern (to build in plan 24-01)

```typescript
// In player dashboard (dashboard.tsx or telemetry-provider.tsx)
// When player clicks "End Session":
async function handleEndSession(sessionId: string) {
  // 1. Broadcast to all listeners (trainer sees it instantly)
  const channel = supabase.channel(`session:${sessionId}`)
  await channel.send({
    type: 'broadcast',
    event: 'session_ended',
    payload: { type: 'session_ended', sessionId, ts: Date.now() },
  })
  // 2. Mark session as ended in DB
  await fetch(`/api/sessions/${sessionId}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'ended' }),
  })
}
```

### Extending useTelemetry to surface sessionEnded (plan 24-01)

```typescript
// In use-telemetry.ts, add to channel setup:
const [sessionEnded, setSessionEnded] = useState(false)

channel.on('broadcast', { event: 'session_ended' }, () => {
  setSessionEnded(true)
})

// Return includes: sessionEnded
return { ..., sessionEnded }
```

### Session-ended overlay component (plan 24-01)

```typescript
// Rendered in TrainerDashboard when sessionEnded === true
// Positioned as fixed overlay above everything
{sessionEnded && (
  <div style={{
    position: 'fixed', inset: 0, zIndex: 10000,
    background: 'rgba(1,10,26,0.92)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    fontFamily: 'Courier New, monospace',
  }}>
    <div className="jarvis-panel" style={{ textAlign: 'center', padding: '32px 48px' }}>
      <div style={{ fontSize: '10px', letterSpacing: '4px', color: '#00ffff', marginBottom: '16px' }}>
        SESSION ENDED
      </div>
      <div style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(0,212,255,0.5)', marginBottom: '24px' }}>
        PILOT HAS ENDED THE SESSION
      </div>
      <button onClick={onExit} style={{...}}>
        RETURN TO JOIN SCREEN
      </button>
    </div>
  </div>
)}
```

### Persistent broadcast channel in useTrainerComm (plan 24-02 fix)

```typescript
// Replace per-call channel creation in sendText with a persistent ref:
const broadcastChannelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

useEffect(() => {
  if (!sessionId) return
  const channelName = getChannelName(sessionId)
  const ch = supabase.channel(channelName, { config: { broadcast: { ack: false } } })
  ch.subscribe()
  broadcastChannelRef.current = ch
  return () => { supabase.removeChannel(ch); broadcastChannelRef.current = null }
}, [sessionId])
```

---

## Integration Flow Validation

Per CONTEXT.md, three flows are equally critical and need verification by audit:

**Flow 1: Session join → trainer sees live telemetry**
- TrainerEntry → `/api/trainer/claim` → TrainerDashboard mounts → `useTelemetry(sessionId)` subscribes → shows `connecting` → receives first telemetry packet → shows `connected` with live data
- Verification: All components receive null-safe data, no crashes on empty telemetry

**Flow 2: Trainer speaks as Jarvis → player hears voice**
- Trainer PTT → `getUserMedia` → `MediaRecorder` → `/api/whisper` → `rephrasedText` via `/api/trainer-rephrase` → `speakWithElevenLabs` (trainer hears) + `supabase.channel.send(conversation)` → player-side `JarvisVoiceProvider` listens (via `use-jarvis-brain` or player's own Whisper/TTS pipeline, NOT directly — the trainer broadcasts the text, the player's `JarvisVoiceProvider` is for AI responses)
- **Important clarification from code review:** The trainer's `sendText` broadcasts a `conversation` event with `role: 'jarvis'`. The player-side receives this in... nothing currently. The player's `JarvisVoiceProvider` does NOT listen for `conversation` events to play audio. The trainer speaks via `speakWithElevenLabs` on the trainer's own device. The player hears through their own audio setup (speakers/headset) — the trainer is speaking AS Jarvis through their own computer's speakers into the sim environment, OR through a shared audio channel.
- **Actually:** Reading the code more carefully — the trainer calls `speakWithElevenLabs` which plays audio on the TRAINER's browser. For the player to hear it, there must be an audio routing assumption (trainer on same machine as DCS, or trainer's audio routed to player via comms). The broadcast is for the LOG/UI only. This is the correct intended design — the trainer is the pilot's actual IP and talks through real comms (TeamSpeak/SRS/Discord) or shares a screen, NOT via Supabase audio streaming.
- This flow needs no code changes — it works as designed.

**Flow 3: Trainer spawns enemies → appear in DCS → alerts fire → player sees on TSD**
- Trainer clicks SPAWN → `ConfirmModal` → `useDcsCommands.sendCommand('spawn_unit', payload)` → broadcasts `dcs_command` on channel → `CommandListener` (Python bridge) receives → `CommandExecutor` runs `custom.Eval` Lua → units spawned in DCS → DCS Lua exports new world objects → UDP → bridge → Supabase `tactical` broadcast → `useTelemetry` receives `TacticalPacket` → player TSD renders new blips, trainer TSD renders new blips → if units trigger alert conditions, `useAlerts` fires → `useVoiceCues` speaks to player
- Verification focus: command timeout path (no bridge running) should show toast "Command timed out", not crash

---

## API Routes Needed for Phase 24

### New: PATCH /api/sessions/:id

For player to mark session as ended.

```typescript
// Pattern: auth check + status update
export async function PATCH(req: NextRequest, { params }: ...) {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  const { id } = await params
  const { status } = await req.json()
  if (status !== 'ended') return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const supabase = createServerSupabase()
  const { error } = await supabase
    .from('sessions')
    .update({ status: 'ended', ended_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', session.user.id) // ensure ownership

  if (error) return NextResponse.json({ error: 'Update failed' }, { status: 500 })
  return NextResponse.json({ ok: true })
}
```

This route goes at `apps/web/src/app/api/sessions/[id]/route.ts` (currently no file there — confirmed by earlier check that only `trainer-code` sub-route exists).

---

## Plan Breakdown Recommendations

### 24-01: Session Lifecycle + "Session Ended" Overlay

Scope:
1. Add `PATCH /api/sessions/:id` API route (status: ended, ended_at)
2. Extend `useTelemetry` to emit `sessionEnded: boolean` (listen for `session_ended` broadcast event)
3. Add `session_ended` broadcast type to `packages/shared/src/types.ts` (optional but clean)
4. Add "End Session" control to player dashboard top-bar or bottom-bar
5. Add "SESSION ENDED" full-screen overlay in `TrainerDashboard` when `sessionEnded === true`
6. `TrainerPage` gains `onExit` pattern: overlay's button calls parent-managed reset back to entry state

### 24-02: Memory Leak Audit + Error Handling Polish

Scope:
1. Fix `useTrainerComm.sendText` — replace per-call channel creation with persistent `broadcastChannelRef`
2. Fix `jarvis-voice-provider.tsx broadcastConversation` — same leak pattern, same fix
3. Harden error messages: `"TTS unavailable (ElevenLabs)"`, `"Transcription failed (Whisper)"`, `"Rephrase unavailable (GPT-4o)"`
4. Mic permission denial: convert to persistent tooltip on PTT button in `TrainerVoiceTab`
5. Add "AWAITING TELEMETRY..." banner to trainer dashboard during `connecting` state
6. TSD empty state: "AWAITING PLAYER POSITION" overlay on canvas when `telemetry === null`
7. Log panel empty state: "NO EVENTS YET" placeholder
8. Audit RAF loops: `trainer-voice-tab.tsx` waveform canvas RAF — verify `cancelAnimationFrame` on unmount (currently only cancels on stage change, not unmount)
9. Verify all `setInterval` / `setTimeout` cleanups across trainer hooks

---

## Common Pitfalls Summary

| Pitfall | Pattern | Already Fixed? |
|---------|---------|----------------|
| Supabase channel not removed | `supabase.channel()` in `sendText` per-call | NO — needs fix |
| Supabase channel not removed | `broadcastConversation` in jarvis-voice-provider | NO — needs fix |
| RAF not cancelled on unmount | `trainer-voice-tab.tsx` waveform | PARTIAL — cancelled on stage change, not explicit unmount |
| Command timeout unhandled | `useDcsCommands` 10s timeout | Already handled — rejects with Error |
| Mic permission error auto-clears | `handleError` 3s reset timer | Exists but UX needs improvement per CONTEXT.md |
| Empty telemetry crashes | Null checks throughout | All null-safe ✓ |

---

## State of the Art

| Old Approach | Current Approach | Impact |
|---|---|---|
| Polling for session status changes | Supabase Realtime broadcast | Instant notification, no polling |
| Per-call Supabase channel creation | Persistent channelRef (correct pattern) | Fixes memory leak |
| Generic error messages | Service-named errors | Better debugging |

---

## Open Questions

1. **Player "End Session" button placement**
   - What we know: needs to be accessible from player dashboard
   - What's unclear: whether `TopBar` or a new bottom-bar control is better
   - Recommendation: Add to `TopBar` near the connection status — simple "END" button, requires confirmation

2. **What happens if player closes tab without clicking "End Session"**
   - What we know: `ended_at` will never be set; trainer will just see telemetry go stale → `dcs_offline` state
   - What's unclear: whether this matters for Phase 24
   - Recommendation: Per CONTEXT.md, no session timeout is needed. Accept this edge case for now.

3. **`jarvis-voice-provider.tsx` channel leak severity**
   - What we know: `broadcastConversation` is called on every player utterance + every Jarvis voice cue
   - What's unclear: how often this triggers in a 30-minute session
   - Recommendation: Fix it in 24-02 since the pattern is identical to the trainer fix. Low effort.

---

## Sources

### Primary (HIGH confidence)
- Direct code inspection of all Phase 21-23 files listed above
- `24-CONTEXT.md` — locked decisions and scope constraints

### Secondary (MEDIUM confidence)
- Phase 23 SUMMARY files — confirmed what was actually built vs planned

### Metadata

**Confidence breakdown:**
- Session lifecycle pattern (session_ended broadcast): HIGH — Supabase Realtime broadcast is the established pattern throughout the codebase
- Memory leak identification: HIGH — verified by direct code inspection of `useTrainerComm.sendText` and `jarvis-voice-provider.tsx`
- Error message locations: HIGH — traced through `useTrainerComm` error paths directly
- RAF leak in `trainer-voice-tab.tsx`: MEDIUM — code shows RAF starts on stage change but cleanup on unmount is in the stage effect's return, which runs — need to verify

**Research date:** 2026-03-18
**Valid until:** 2026-04-18 (stable codebase, no external dependencies to drift)
