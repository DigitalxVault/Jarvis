# JARVIS DCS Prototype — Testing Plan (Phase 1)

This plan targets **Phase 1 Prototype**: end-to-end connectivity and minimal telemetry rendering.

---

## A) Where this belongs
- Keep this **as a separate file** for execution and iteration.
- Keep a **short summary section** in PRD.md so stakeholders see test scope at a glance.

---

## B) Test Environment

### B1) DCS Environment
- DCS version: __________
- Mission: simple free flight or a training mission with 1–2 trigger zones
- Export method: Export.lua / injected Lua
- Export rate: 10 Hz

### B2) Local Bridge
- OS: Windows 10/11
- Runtime: Node/Python
- Listening endpoint: UDP localhost port __________
- Cloud provider: Supabase Realtime / Ably / Pusher
- Auth method: pairing code

### B3) Web UI
- Hosted on Vercel
- Google login enabled
- Live telemetry page with connection status + 3 cards: IAS/ALT/HDG
- Debug panel: last packet time, packets/sec

---

## C) Acceptance Criteria (Phase 1)
1. Pairing works (web session ↔ bridge bound correctly).
2. Telemetry updates in near-realtime (< 500 ms typical).
3. Resilience (internet drop/reconnect; DCS exporter stops).
4. No runaway resource usage in a 20-minute session.

---

## D) Test Cases

### D1) Smoke Test — Full Pipeline
**Steps**
1. Web UI → sign in.
2. Create session → copy pairing code.
3. Start bridge with pairing code.
4. Start DCS mission and confirm exporter is running.

**Expected**
- UI shows Connected
- IAS/ALT/HDG update
- Debug shows packets/sec ~ 10 Hz
- Last packet time updates continuously

### D2) Rate / Throttle Verification
**Steps**
1. Set exporter to 10 Hz.
2. Observe bridge receive rate and UI update behavior.

**Expected**
- Bridge receives ~10 packets/sec
- UI renders smoothly (UI may downsample)

### D3) Packet Loss Handling (UDP)
**Steps**
1. Introduce load or artificial loss (optional).
2. Observe UI continuity.

**Expected**
- Minor gaps tolerated
- No crashes

### D4) Internet Drop / Reconnect
**Steps**
1. Disconnect internet for 30 seconds.
2. Reconnect.

**Expected**
- UI shows Offline/Reconnecting
- Telemetry resumes automatically
- No duplicate sessions

### D5) DCS Stop Sending (Exporter Off)
**Steps**
1. Stop mission or disable exporter.
2. Watch UI status.

**Expected**
- “No telemetry received” within N seconds
- Telemetry stops updating

### D6) Auth / Session Scope
**Steps**
1. Start Session A → pair Bridge A.
2. Create Session B → ensure Bridge A cannot publish to Session B without re-pair.

**Expected**
- Session scoping enforced
- No cross-session leakage

---

## E) Instrumentation Checklist

### E1) Bridge logs must include
- Pairing success/failure
- Receive packet count
- Publish success/failure + retry count
- Last publish timestamp
- Queue size (if buffering)

### E2) UI debug panel must include
- Connection state
- Last packet time
- Packets/sec (smoothed)
- Current session id
- Provider subscription status

---

## F) Prototype Exit Criteria
Proceed to Phase 2 when:
- D1–D6 pass consistently
- 20-minute run is stable
- Failure modes show clear UI/bridge statuses
