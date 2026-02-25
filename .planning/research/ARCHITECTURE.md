# Architecture Patterns: JARVIS DCS Realtime Telemetry Pipeline

**Domain:** Realtime game telemetry streaming (local game → bridge → cloud pub/sub → web)
**Researched:** 2026-02-25
**Overall confidence:** HIGH (architecture is well-established; Supabase specifics verified against official docs)

---

## Recommended Architecture

The system is a four-layer unidirectional telemetry pipeline with a bidirectional session management sideband.

```
[DCS Game Process]
    |
    | UDP JSON datagrams, localhost:PORT, 10 Hz
    v
[Local Bridge Service]  (Node.js, Windows PC)
    |  \
    |   \-- [Session DB] Supabase Postgres (session lifecycle)
    |
    | WebSocket (Supabase Realtime SDK) or REST POST
    v
[Supabase Realtime Cluster]  (Elixir/Phoenix, globally distributed)
    |
    | WebSocket (browser)
    v
[Next.js Web UI]  (Vercel, stateless)
```

### Two separate flows exist simultaneously

**Telemetry flow (hot path):** DCS → Bridge → Supabase Broadcast → Browser. Ephemeral, high-frequency, no persistence required for Phase 1.

**Session/pairing flow (control path):** Browser → Supabase Postgres → Bridge authenticates → Bridge publishes to scoped channel. This is the sideband that makes the hot path secure and session-scoped.

---

## Component Boundaries

| Component | Responsibility | Owns | Does NOT Own |
|-----------|---------------|------|-------------|
| Export.lua | Extract flight data from DCS, serialize to JSON, send UDP | Telemetry serialization, rate throttling (10 Hz) | Network auth, session state, cloud connectivity |
| Node.js Bridge | Receive UDP, authenticate with Supabase, publish to Realtime channel | UDP socket, Supabase client, reconnect logic, session token | Web UI state, DCS simulation logic, user auth |
| Supabase Postgres | Session records, pairing codes, user↔session mapping | Persistent state, RLS enforcement, pairing code TTL | Telemetry relay, UI rendering |
| Supabase Realtime | Ephemeral message relay (broadcast) | WebSocket connections, message fan-out | Message persistence (by design), business logic |
| Next.js Web UI | User auth, session management UI, telemetry rendering | NextAuth.js session, channel subscription, display logic | Bridge process management, DCS game state |

**Critical boundary:** The bridge is the only component that crosses the NAT boundary. Everything to its left is localhost-only. Everything to its right is public internet.

---

## Data Flow: Hop-by-Hop

### Hop 1: DCS → Bridge (UDP, localhost)

**Direction:** DCS pushes, bridge receives (fire-and-forget).

```
DCS Export.lua
  LuaExportAfterEachFrame() or LuaExportActivityNextEvent()
    → throttle to 10 Hz (frame counter or timer.scheduleFunction)
    → collect LoGetSelfData(), LoGetModelTime(), LoGetMagneticYaw()
    → serialize: net.lua2json(payload)
    → socket:sendto(json, "127.0.0.1", BRIDGE_PORT)
```

**Protocol characteristics:**
- UDP: no connection, no ACK, packets may drop silently. This is acceptable at 10 Hz — dropped frames are not retransmitted.
- Payload: newline-terminated JSON strings, typically 200-500 bytes each.
- Port: configurable; 7778 is a common convention for DCS tools (Tacview uses it). JARVIS should use a distinct port (e.g., 7779) to avoid conflicts.
- DCS and bridge run on the same Windows machine; localhost UDP never crosses NAT.

**Bridge UDP receiver (Node.js):**
```javascript
import dgram from 'node:dgram'

const server = dgram.createSocket('udp4')
server.bind(7779, '127.0.0.1')  // localhost only

server.on('message', (msg, rinfo) => {
  const packet = JSON.parse(msg.toString())
  pipeline.ingest(packet)  // forward to publish queue
})
```

### Hop 2: Bridge → Supabase Realtime (WebSocket or REST)

**Direction:** Bridge publishes outbound (push).

Two publishing approaches are available. **Use the persistent WebSocket approach** (not per-packet REST POST) to avoid HTTP connection overhead at 10 Hz:

```javascript
// Bridge uses Supabase JS SDK with service_role key
import { createClient } from '@supabase/supabase-js'

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY)
const channel = supabase.channel(`session:${sessionId}`)

await channel.subscribe()

// On each telemetry packet:
channel.send({
  type: 'broadcast',
  event: 'telemetry',
  payload: packet
})
```

**REST API alternative** (fallback / simpler reconnect logic):
```
POST https://<ref>.supabase.co/realtime/v1/api/broadcast
Authorization: Bearer <service_role_key>
{
  "messages": [{
    "topic": "session:<sessionId>",
    "event": "telemetry",
    "payload": { ... }
  }]
}
```

The REST API is stateless but adds ~20-50ms per packet from HTTP overhead. Use it only as a fallback when WebSocket reconnection is in progress.

**Key constraint:** The bridge uses the `service_role` key (never exposed to browser). The browser uses the `anon` key with the user's JWT. These are separate Supabase client instances with different privileges.

### Hop 3: Supabase Realtime → Browser (WebSocket)

**Direction:** Supabase pushes to all subscribers on the channel.

Supabase Realtime is a globally distributed Elixir/Phoenix cluster. Broadcast mode fans out messages from the publisher to all connected subscribers on the same topic. Messages are ephemeral — not stored (except optionally in `realtime.messages` with a 3-day retention window, which is not needed for Phase 1 telemetry).

**Channel fan-out latency:** Sub-100ms within region; cross-region adds cluster ping time. For a single pilot + single browser, fan-out is 1:1 — effectively direct relay with minimal overhead.

### Hop 4: Browser → Next.js UI (in-process)

**Direction:** Supabase Realtime client calls event handler in-process.

```javascript
// Next.js component (client-side)
const channel = supabase.channel(`session:${sessionId}`)

channel
  .on('broadcast', { event: 'telemetry' }, ({ payload }) => {
    setTelemetry(payload)  // React state update → re-render
  })
  .subscribe()
```

React state updates batch at 60 fps by default. At 10 Hz inbound, every packet triggers a state update. This is well within React's rendering budget.

---

## Channel Strategy

### Naming Convention

```
session:<sessionId>
```

Where `sessionId` is a UUID generated when the user creates a Live Session in the web UI. This approach:
- Scopes each pilot's stream to their session
- Prevents cross-session leakage without complex RLS
- Makes channel names predictable and debuggable
- Supports future multi-session (instructor view) by subscribing to multiple channels

**Do not use:** `user:<userId>` — this would mix all sessions for a user, and would not support session isolation or handover.

**Do not use:** Generic `telemetry` channel — single channel for all users is a security and isolation failure.

### Channel Authorization

For Phase 1 (public channels, fast iteration):
- Bridge publishes using `service_role` key — bypasses RLS entirely.
- Browser subscribes using `anon` key + user JWT — channel is public, any authenticated user can subscribe.
- Session scoping is enforced at the application level: the web UI only subscribes to the session it owns (stored in Postgres).

For Phase 2+ (private channels with RLS):
```sql
-- Allow authenticated users to subscribe to their own session channel
CREATE POLICY "user can subscribe to own session"
ON realtime.messages
FOR SELECT
TO authenticated
USING (
  realtime.topic() = 'session:' || (
    SELECT id::text FROM sessions
    WHERE user_id = auth.uid()
    AND status = 'active'
    LIMIT 1
  )
);

-- Allow bridge (service role) to publish to any session channel
CREATE POLICY "service role can publish"
ON realtime.messages
FOR INSERT
TO service_role
WITH CHECK (true);
```

### Event Types on a Session Channel

| Event | Sender | Frequency | Payload |
|-------|--------|-----------|---------|
| `telemetry` | Bridge | 10 Hz | Full telemetry packet (IAS, ALT, HDG, position, etc.) |
| `event` | Bridge | On change | Training event (kill, gate, etc.) — Phase 2 |
| `status` | Bridge | On change | Bridge lifecycle (connected, disconnecting, error) |
| `heartbeat` | Bridge | 1 Hz | Keepalive with bridge uptime, packet count |

The browser uses the `heartbeat` event to distinguish "no packets" (DCS stopped) from "bridge disconnected" (Supabase WebSocket dropped).

---

## Session Pairing Flow (End-to-End)

Session pairing solves: "How does the local bridge, running on an anonymous Windows PC, earn the right to publish to a specific user's Realtime channel?"

### Database Schema (Supabase Postgres)

```sql
-- Sessions table
CREATE TABLE sessions (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id),
  status      TEXT NOT NULL DEFAULT 'pending',  -- pending | active | ended
  pairing_code TEXT UNIQUE,                       -- 6-char alphanumeric, TTL enforced by app
  pairing_expires_at TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  ended_at    TIMESTAMPTZ,
  mission_name TEXT
);

-- Bridge tokens (issued after pairing)
CREATE TABLE bridge_tokens (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  UUID NOT NULL REFERENCES sessions(id),
  token_hash  TEXT NOT NULL,   -- bcrypt hash of the actual token
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_used_at TIMESTAMPTZ,
  revoked_at  TIMESTAMPTZ
);
```

### Pairing Flow Step-by-Step

```
STEP 1 — User creates session (Browser → Supabase Postgres)
  Web UI:
    POST /api/sessions  (Next.js API route, authenticated)
      → INSERT sessions (user_id, status='pending', pairing_code=random6(), pairing_expires_at=now()+5min)
      → Return: { sessionId, pairingCode: "A7X2K9" }
    UI shows: pairing code "A7X2K9" with countdown timer

STEP 2 — User starts bridge with pairing code (Bridge CLI)
  > node bridge.js --code A7X2K9

STEP 3 — Bridge authenticates (Bridge → Supabase Postgres via REST)
  Bridge:
    POST /api/bridge/claim  (Next.js API route, unauthenticated — code is the credential)
      Body: { pairingCode: "A7X2K9" }
      Server logic:
        1. SELECT session WHERE pairing_code='A7X2K9' AND status='pending' AND pairing_expires_at > now()
        2. If found: generate bridgeToken (random UUID)
        3. INSERT bridge_tokens (session_id, token_hash=bcrypt(bridgeToken))
        4. UPDATE sessions SET status='active', pairing_code=NULL (invalidate code immediately)
        5. Return: { sessionId, bridgeToken, channelName: "session:<id>" }
      Server error cases:
        - Code not found or expired → 404
        - Code already claimed → 409

STEP 4 — Bridge publishes to channel (Bridge → Supabase Realtime)
  Bridge now holds: sessionId, bridgeToken, channelName
  Bridge calls Supabase with service_role key (bundled in bridge .env)
  Bridge joins channel: session:<sessionId>
  Bridge sends status event: { type: 'status', event: 'bridge_connected' }

STEP 5 — Web UI detects bridge (Browser ← Supabase Realtime)
  Web UI is already subscribed to session:<sessionId> (created in Step 1)
  Receives bridge_connected event → shows "Connected" indicator
  Telemetry begins flowing

STEP 6 — Session ends (Browser or timeout)
  Initiated by user clicking "End Session" OR auto-timeout after N minutes of no heartbeat
  Web UI: PATCH /api/sessions/:id  → status='ended'
  Bridge receives status event or next REST call returns 403 → bridge exits cleanly
```

### Security Properties of This Flow

- **Pairing code is single-use:** Invalidated immediately on successful claim (Step 3, item 4).
- **Pairing code is short-lived:** 5-minute TTL enforced server-side.
- **Bridge token is scoped:** bridge_tokens.session_id restricts what the bridge can do.
- **service_role key stays on bridge:** Never sent to browser. Bridge .env is local only.
- **Bridge publishes to one channel:** Channel name is derived from session_id received at claim time; bridge has no way to enumerate other sessions.
- **Cross-session isolation:** If user creates Session B, Bridge A's token is for Session A only. Test case D6 in the test plan validates this.

---

## Monorepo Structure

```
jarvis-dcs/
├── apps/
│   └── web/                          # Next.js App Router (Vercel)
│       ├── app/
│       │   ├── (auth)/
│       │   │   └── login/page.tsx    # Google sign-in + JARVIS splash
│       │   ├── dashboard/
│       │   │   └── page.tsx          # Live telemetry dashboard
│       │   └── api/
│       │       ├── auth/[...nextauth]/route.ts
│       │       ├── sessions/route.ts          # Create/list sessions
│       │       ├── sessions/[id]/route.ts     # End session
│       │       └── bridge/claim/route.ts      # Bridge pairing claim
│       ├── components/
│       │   ├── TelemetryCard.tsx     # IAS/ALT/HDG display cards
│       │   ├── ConnectionStatus.tsx  # Online/Reconnecting/Offline
│       │   └── DebugPanel.tsx        # Last packet time, pkt/sec, session ID
│       └── package.json
│
├── packages/
│   ├── bridge/                       # Node.js bridge service (run on Windows)
│   │   ├── src/
│   │   │   ├── index.ts              # Entry point: parse args, orchestrate
│   │   │   ├── udp-receiver.ts       # dgram socket, packet parsing
│   │   │   ├── supabase-publisher.ts # Realtime channel management
│   │   │   ├── claim.ts              # Pairing code claim flow
│   │   │   ├── reconnect.ts          # Exponential backoff reconnect
│   │   │   └── metrics.ts            # Packet counter, queue size logging
│   │   ├── dcs/
│   │   │   └── Export.lua            # DCS Export.lua (deployed to DCS Saved Games)
│   │   └── package.json
│   │
│   └── shared/                       # Shared TypeScript types (no runtime deps)
│       ├── src/
│       │   ├── telemetry.ts          # TelemetryPacket, EventPacket types
│       │   ├── session.ts            # Session, BridgeStatus types
│       │   └── channels.ts           # Channel naming helpers
│       └── package.json
│
├── package.json                      # pnpm workspace root
├── pnpm-workspace.yaml
└── turbo.json                        # Optional: Turborepo for parallel builds
```

**Why this structure:**
- `apps/web` and `packages/bridge` are deployed separately (Vercel vs. local Windows).
- `packages/shared` contains TypeScript types and constants shared between web and bridge — ensures schema drift is caught at compile time, not at runtime.
- Export.lua lives in `packages/bridge/dcs/` — it's the bridge's DCS-side counterpart, versioned together.
- No code from `packages/bridge` is ever bundled into `apps/web` (it's a Node.js service, not a browser library). Shared types only.

**Workspace tool recommendation:** pnpm workspaces without Turborepo for Phase 1. Add Turborepo in Phase 2 when build caching becomes useful across multiple apps.

---

## Patterns to Follow

### Pattern 1: Stateless Bridge with External State

**What:** The bridge holds no persistent state between restarts. Session tokens are stored in Supabase Postgres. The bridge re-claims on each startup.

**Why:** Simplifies reconnect logic. If the bridge crashes and restarts, it re-authenticates with the same bridgeToken (which it caches locally in memory or a temp file for the session lifetime). All state about what was published lives in Supabase.

**Implementation note:** On restart, if the bridge has a valid sessionId + bridgeToken in memory (not crashed), it re-subscribes to the same channel. If it crashed and lost state, the user re-pairs with a new code. The session record in Postgres remains, allowing the web UI to reattach to the same session.

### Pattern 2: Publish Queue with Backpressure

**What:** UDP packets are placed on an in-memory queue. A separate async loop drains the queue and publishes to Supabase. The queue absorbs bursts and internet hiccups.

**Why:** UDP ingest is synchronous and fast. Supabase publish is async and can fail. Decoupling these with a queue prevents head-of-line blocking and enables graceful degradation during reconnect.

```javascript
// Simplified queue pattern
class PublishQueue {
  private queue: TelemetryPacket[] = []
  private maxSize = 100  // drop oldest on overflow (not newest)

  enqueue(packet: TelemetryPacket) {
    if (this.queue.length >= this.maxSize) {
      this.queue.shift()  // drop oldest, keep latest
    }
    this.queue.push(packet)
  }

  async drain(channel: RealtimeChannel) {
    while (this.queue.length > 0) {
      const packet = this.queue.shift()!
      await channel.send({ type: 'broadcast', event: 'telemetry', payload: packet })
    }
  }
}
```

**Drop strategy:** Drop oldest packets (not newest). During reconnect, the web UI wants the most recent flight state, not old data.

### Pattern 3: Heartbeat-Based Connection State Machine

**What:** Both the bridge and the web UI maintain explicit connection state machines driven by heartbeat signals, not just WebSocket connect/disconnect events.

**Why:** There are three distinct failure modes that require different UI states:
1. Bridge process is not running (no connection at all).
2. Bridge is running but DCS is not sending (bridge connected, no telemetry).
3. Bridge is running, DCS sending, but Supabase WebSocket dropped (in-progress reconnect).

The web UI cannot distinguish these without explicit signals from the bridge.

**Bridge states:** `disconnected → claiming → connected → reconnecting → disconnected`
**Web UI telemetry states:** `waiting_for_bridge → bridge_connected → receiving → stale → bridge_gone`

The `heartbeat` event (1 Hz) from the bridge carries `{ bridgeUptime, dcsActive, packetCount, queueSize }`. The web UI tracks the last heartbeat timestamp. If no heartbeat for 5 seconds → show "Bridge Offline". If heartbeat present but `dcsActive=false` → show "DCS not sending".

### Pattern 4: UDP-to-Bridge Port Isolation

**What:** Export.lua sends to a JARVIS-specific port (e.g., 7779), not the standard Tacview/SRS ports.

**Why:** DCS users commonly run multiple Export.lua listeners simultaneously (Tacview, SimShaker, SRS, etc.). Port conflicts cause silent packet loss. Using a dedicated port for JARVIS avoids interference.

**Implementation:** The port is a configurable constant in both Export.lua and the bridge. Default 7779.

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Browser Receives UDP Directly

**What:** Trying to receive DCS UDP packets in the browser or a Vercel serverless function.

**Why bad:** Browsers have no UDP socket API. Vercel functions are stateless and cannot maintain a long-lived listener. This is exactly why the local bridge exists.

**Instead:** Bridge is the UDP recipient. Browser subscribes to Supabase Realtime only.

### Anti-Pattern 2: Polling Supabase for Telemetry

**What:** Using Supabase Postgres polling (SELECT on a telemetry table, refresh every 100ms) instead of Realtime broadcast.

**Why bad:** At 10 Hz, polling adds database load, introduces 100ms+ latency per poll cycle, and burns Postgres read quota on free tier. Realtime broadcast is designed for exactly this use case — ephemeral fan-out without persistence.

**Instead:** Use Supabase Realtime Broadcast. Do not store telemetry in Postgres for Phase 1 real-time rendering. Store only events and session metadata.

### Anti-Pattern 3: service_role Key in Browser

**What:** Bundling the `service_role` key into the Next.js app (even in server components) where it might be exposed via client bundles.

**Why bad:** `service_role` bypasses all RLS. If exposed, any client can read or write all data in the Supabase project.

**Instead:** `service_role` is only in the bridge `.env` on the local Windows PC. The Next.js app uses only the `anon` key + NextAuth.js session JWTs.

### Anti-Pattern 4: One Global Telemetry Channel

**What:** All bridges publish to `channel('telemetry')` — a single shared channel.

**Why bad:** All users would receive all pilots' data. Session isolation fails. Phase 4 (multi-pilot) becomes impossible to retrofit.

**Instead:** Channel naming is `session:<sessionId>` from day one. This costs nothing and makes the architecture future-proof.

### Anti-Pattern 5: Synchronous UDP Processing

**What:** The bridge's UDP message handler directly calls `await channel.send()` before returning.

**Why bad:** If Supabase is slow or reconnecting, the UDP handler blocks. On Node.js, a blocked async handler with `await` in the message callback causes the event loop to back up, leading to packet loss from the OS UDP buffer overflow.

**Instead:** UDP handler is synchronous and only enqueues the packet. An independent async drain loop handles publishing. These are never on the same call stack.

### Anti-Pattern 6: Reconnect Without Exponential Backoff

**What:** Bridge retries Supabase connection in a tight loop (retry every 100ms on failure).

**Why bad:** Rapid retries hammer Supabase during outages, quickly exhaust free tier connection limits, and fill logs with noise.

**Instead:** Exponential backoff starting at 1s, capping at 30s, with jitter. The Supabase JS SDK has built-in reconnect; verify it is enabled rather than implementing a second layer.

---

## Build Order Implications

Build order is driven by dependency direction: nothing upstream can be tested without the layer below it being functional.

### Recommended Build Order

```
Phase 1a — Shared Foundation (2-4 hours)
  1. Monorepo scaffold (pnpm workspaces, tsconfig)
  2. packages/shared: TelemetryPacket type, channel naming helper
  3. Supabase project: create sessions table, verify Realtime is enabled
  Rationale: Types used by both bridge and web must exist first.

Phase 1b — Bridge Core (1-2 days)
  4. UDP receiver (dgram, localhost, JSON parse)
  5. Supabase publisher (create client, join channel, send broadcast)
  6. Smoke test with netcat or a test script sending fake packets
  Rationale: Bridge is the critical relay. Verify it works before DCS.

Phase 1c — Export.lua (half day)
  7. Write Export.lua with LuaExportAfterEachFrame throttled to 10 Hz
  8. Verify packets arrive at bridge with DCS running
  Rationale: DCS Lua environment is opaque; isolate and verify separately.

Phase 1d — Web UI Foundation (1-2 days)
  9. Next.js App Router scaffold, NextAuth.js Google provider
  10. Supabase client in browser, subscribe to channel, log raw events
  11. Session create API route (/api/sessions)
  Rationale: Build the subscription before building the UI.

Phase 1e — Pairing Flow (half day to 1 day)
  12. Pairing code generation + sessions table insert
  13. /api/bridge/claim API route + bridge_tokens table
  14. Bridge claim.ts (HTTP POST to /api/bridge/claim)
  15. End-to-end test: pair bridge, verify it publishes to correct channel
  Rationale: Pairing is a pre-condition for secure full-pipeline testing.

Phase 1f — Telemetry UI (half day to 1 day)
  16. TelemetryCard components (IAS, ALT, HDG)
  17. ConnectionStatus component (bridge heartbeat logic)
  18. DebugPanel (last packet time, pkt/sec, session ID)
  Rationale: UI is the last layer; only meaningful once pipeline is proven.

Phase 1g — Resilience (half day)
  19. Bridge reconnect with exponential backoff
  20. Publish queue with drop-oldest overflow
  21. Bridge heartbeat (1 Hz status broadcast)
  22. Test cases D4 (internet drop) and D5 (DCS stop)
```

**Critical path:** Steps 4-5 → Step 7 → Steps 9-10 → Steps 12-14 form the critical path. Everything else is parallel or additive.

**First milestone that proves the pipeline works:** Bridge publishes a fake packet, browser receives it via Supabase Realtime. This happens at the end of Phase 1b + 1d, before pairing is implemented.

---

## Scalability Considerations

This architecture is explicitly Phase 1 / single-pilot. Notes for future phases:

| Concern | Phase 1 (single pilot) | Phase 4 (multi-pilot) |
|---------|----------------------|----------------------|
| Channel count | 1 active session channel | 1 channel per active session; subscriber (instructor) joins multiple |
| Supabase free tier | 200 concurrent connections, suitable for prototype | May need paid tier at >10 concurrent sessions |
| Bridge process | Single process on pilot's PC | No change — each pilot runs their own bridge |
| Instructor view | Not needed | Subscribe to multiple `session:<id>` channels simultaneously |
| Telemetry storage | Not stored (Phase 1) | Downsample to 1 Hz in bridge before writing to Postgres |

---

## Sources

- Supabase Realtime Broadcast documentation: https://supabase.com/docs/guides/realtime/broadcast
- Supabase Realtime Architecture: https://supabase.com/docs/guides/realtime/architecture
- Supabase Realtime Authorization: https://supabase.com/docs/guides/realtime/authorization
- Supabase Broadcast Authorization blog: https://supabase.com/blog/supabase-realtime-broadcast-and-presence-authorization
- DCS Export.lua reference: https://wiki.hoggitworld.com/view/DCS_export
- dcs-jupyter reference implementation: `.docs/dcs_jupyter-0.1.6/` (UDP socket pattern, LuaSocket usage)
- Project context: `PROJECT.md`, `PRD.md`, `JARVIS_DCS_Prototype_Test_Plan.md`
- DCS data reference: `documents/DCS_Gameplay_Data_Export_Catalogue.md`

**Confidence notes:**
- Component boundaries and data flow: HIGH (derived from confirmed architectural constraints in PRD + Supabase docs)
- Supabase Realtime broadcast API: HIGH (verified against official docs 2026-02-25)
- Session pairing design: HIGH (pattern is standard device-pairing, implemented against Supabase Postgres)
- Build order: MEDIUM (estimates based on domain experience; DCS Lua environment may surface surprises)
- Monorepo structure: HIGH (standard pnpm workspaces pattern, verified against 2025-2026 community practice)
