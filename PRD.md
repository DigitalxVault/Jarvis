# PRD — JARVIS for DCS (Realtime Copilot + Dashboard)

**Document version:** 0.1  
**Date:** 2026-02-25  
**Product name:** JARVIS (DCS Companion)

---

## 1. Purpose

JARVIS is a companion system for **Digital Combat Simulator (DCS)** that:
1) **Streams gameplay telemetry and training events** out of DCS during live play, and  
2) Presents them in a **JARVIS-style web dashboard** (hosted on Vercel) for realtime monitoring and coaching, and  
3) Optionally **injects guidance back into DCS** (e.g., on-screen messages, scoring, mission flow triggers) using Lua.

Primary outcomes:
- Enable training missions to show **score, gate progress, and adherence metrics** in real time.
- Provide **clear coaching prompts** (“Maintain 350 kt”, “Climb to 6,000 ft”) based on exported data.
- Support a cinematic “JARVIS” UI experience while remaining practical for training.

---

## 2. Goals and Non-Goals

### 2.1 Goals
- **Realtime telemetry pipeline** from DCS → local bridge → cloud realtime → web UI.
- **Training events** (trigger zones, kills, pass/fail, penalties) shown as a structured event feed.
- **Coaching rules** based on band checks and mission context.
- **User authentication** via Google login.
- **Pilot-session binding**: a signed session link/code to associate a local bridge instance with a logged-in web user.

### 2.2 Non-Goals (Phase 1)
- Full “voice command” control of the aircraft.
- Automatic creation of mission files without any Mission Editor steps.
- Multiplayer server-wide monitoring (Phase 1 focuses on single pilot sessions; MP later).

---

## 3. Users and Use Cases

### 3.1 Primary user
- A pilot / trainee running DCS locally who wants a realtime training assistant + score display.

### 3.2 Secondary users (future)
- Instructor observing trainee sessions.
- Team lead tracking multiple pilots (requires multi-session aggregation).

### 3.3 Key use cases
1) Start a training mission, open JARVIS dashboard, see live IAS/ALT/HDG + score.  
2) Pass trigger zones (“gates”) and see immediate confirmation + updated score.  
3) Destroy a target (e.g., chopper) and see event “Kill +50” and cumulative score.  
4) Go out of speed/altitude bands and receive a coaching prompt.  
5) Export session summary for after-action review.

---

## 4. System Overview (High-Level Architecture)

### 4.1 Components
1) **DCS-side Exporter**
   - Export.lua and/or injection script to extract telemetry.
   - Mission scripting to detect gates/events and update flags/state.

2) **Local Bridge Service** (runs on the player PC)
   - Receives telemetry/events from DCS (UDP recommended).
   - Authenticates and publishes updates to cloud realtime channels.
   - Handles buffering and reconnection when internet drops.

3) **Cloud Realtime + Storage**
   - Realtime provider (Supabase Realtime / Ably / Pusher).
   - Database for sessions and events (Supabase Postgres recommended).

4) **Web App (Vercel)**
   - Next.js app with Google login.
   - Subscribes to realtime channels and renders JARVIS UI.

### 4.2 Data flow
DCS → (UDP JSON) → Local Bridge → (HTTPS/Provider SDK) → Realtime Channel → Vercel UI

### 4.3 Why a local bridge is required
- DCS runs behind NAT/firewall and is not reachable from Vercel directly.
- Vercel is not intended to host long-lived WebSocket servers for inbound telemetry.
- The bridge provides a stable local endpoint + secure cloud publishing.

---

## 5. Functional Requirements

### 5.1 Prototype Task 1: Connectivity + Minimal Telemetry (MVP)
**Objective:** Prove the end-to-end pipeline works.

**Requirements**
- DCS exporter sends **telemetry packets** at 10 Hz:
  - time, lat, lon, alt_msl, ias, hdg, pitch, bank, fuel (if available)
  - mission state: score, stage, gateId (if available)
- Local bridge receives packets and forwards them to cloud.
- Web UI displays:
  - Connection indicator (Connected / Reconnecting / Offline)
  - Live telemetry cards (IAS/ALT/HDG)
  - Raw packet viewer (for debugging)

**Success criteria**
- UI updates within < 500 ms typical latency on local internet.
- No memory growth / runaway logs in a 20-minute session.
- Reconnect behavior works (disconnect internet for 30s, resume).

### 5.2 Training Events + Score
- Mission scripting defines trigger zones and events:
  - enter_zone, exit_zone, gate_passed, gate_failed
  - kill (+50 for choppers), hit, crash (if used)
- Local bridge forwards events immediately.
- UI shows event feed with timestamps and score deltas.

### 5.3 Coaching Engine (Rule-Based, Phase 1)
- Rules run in Local Bridge (preferred) or Web UI (acceptable for Phase 1).
- Inputs: telemetry + mission context + thresholds.
- Output: coaching prompts displayed in the UI and optionally injected into DCS on-screen.

Example rules:
- If IAS outside band for > 3 seconds → “Adjust speed to {targetBand}”
- If ALT outside band for > 3 seconds → “Climb/Descend to {targetBand}”
- If gate missed → “Turn to heading {computed}”

### 5.4 Inject Guidance Back Into DCS (Optional in Phase 1, Required in Phase 2)
- When a coaching prompt is generated, system may:
  - Show message in DCS (trigger.action.outText)
  - Play a cue sound (optional)
  - Adjust mission flags if required (penalty increments, stage transitions)

### 5.5 Authentication and Session Pairing
- Web UI: Google sign-in.
- Pairing flow:
  1) User signs in on web.
  2) User creates “Live Session”.
  3) Web generates a short-lived **pairing code** (e.g., 6 digits) or QR.
  4) Local bridge is started with the pairing code.
  5) Cloud authorizes the bridge to publish to the user’s session channel.

### 5.6 Session Management
- Start session / end session.
- Auto-end if no packets received for N minutes.
- Session list with timestamps and mission name (if provided).

### 5.7 Data Storage
- Store:
  - Sessions (userId, createdAt, endedAt, mission meta)
  - Events (type, payload, scoreDelta, time)
  - Optional downsampled telemetry (1 Hz) for replay/graphs

### 5.8 Dashboard UI Requirements (JARVIS Theme)
- Splash screen with “eye scan” animation when clicking “Sign in with Google”.
- Dashboard layout:
  - Flight telemetry tape cards (IAS/ALT/HDG/VVI)
  - Score + stage + gate progress
  - Event feed
  - Coaching panel (top priority)
- Visual style: high-tech HUD, minimal clutter, responsive.

### 5.9 Audio / Voice Cues
- Jarvis voice cues triggered by:
  - session start/end
  - gate events
  - critical warnings (out-of-band, stall margin, low altitude)
- Audio should not spam (rate-limited).

---

## 6. Data Contract

### 6.1 Telemetry schema (10–20 Hz)
```json
{
  "type": "telemetry",
  "t_model": 1234.56,
  "pos": { "lat": 1.234, "lon": 103.456, "alt_m": 2500.0 },
  "att": { "pitch_rad": 0.01, "bank_rad": -0.12, "yaw_rad": 1.5 },
  "spd": { "ias_mps": 140.0, "vvi_mps": 2.0, "mach": 0.45 },
  "fuel": { "internal_kg": 1200.0 },
  "mission": { "score": 120, "stage": 2, "gate": "WP03" }
}
```

### 6.2 Event schema (on change)
```json
{
  "type": "event",
  "t_model": 1240.10,
  "event": "chopper_destroyed",
  "scoreDelta": 50,
  "meta": { "unitName": "Mi-8 #2" },
  "mission": { "score": 170, "stage": 2, "gate": "WP03" }
}
```

---

## 7. Security Requirements
- Pairing code is short-lived (e.g., 5 minutes).
- Bridge publish permissions scoped to a single session/channel.
- No sensitive secrets in the browser.
- Rate limit inbound publish requests at the provider/edge.
- Prefer localhost-only for DCS exporter → bridge transport.

---

## 8. Performance Requirements
- Telemetry update rate: 10 Hz (prototype) / 20 Hz (optional).
- End-to-end latency target: < 500 ms typical.
- Bridge should handle packet loss (UDP) and temporary internet outages.

---

## 9. Reliability and Observability
- Bridge logs: connection status, packet counts, publish errors.
- UI: last packet time, packets/sec, reconnect attempts.
- Cloud: session and event counts.

---

## 10. UX Requirements

### 10.1 Splash / Login
- Splash screen with HUD frame.
- “Eye scan” animation triggered on click of Google sign-in.
- After login: Create Live Session + show pairing code.

### 10.2 Live Dashboard
- Always-visible connection status.
- Large readable score + stage.
- Coaching prompt always on top, short and actionable.

---

## 11. Phases and Milestones
- **Phase 1:** End-to-end connectivity + minimal telemetry UI.
- **Phase 2:** Training events + scoring + basic coaching.
- **Phase 3:** DCS injection + audio cues.
- **Phase 4:** Instructor view / multi-session + replay reports.

---

## 12. Open Questions
- Which aircraft module is targeted first?
- Single-player only in Phase 1, or multiplayer compatibility required?
- Desktop browser only or mobile too?
- Preferred realtime provider?

---

## 13. Appendix: Testing (Summary)
Detailed testing steps are in **`JARVIS_DCS_Prototype_Test_Plan.md`**. Keep it separate for execution and iteration, and keep this summary in the PRD.
