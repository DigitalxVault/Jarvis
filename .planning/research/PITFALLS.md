# Domain Pitfalls: DCS Telemetry Streaming to Web Dashboard

**Domain:** Real-time game telemetry pipeline — DCS Export.lua to cloud relay to web UI
**Project:** JARVIS Phase 1 Prototype
**Researched:** 2026-02-25
**Overall confidence:** HIGH for DCS Export.lua quirks (community-verified); HIGH for Supabase/Vercel limits (official docs); MEDIUM for memory/process pitfalls (general Node.js knowledge + community reports)

---

## How to Read This Document

Each pitfall includes:
- **Severity**: CRITICAL (causes pipeline failure or data loss) / HIGH (causes unreliability or missed latency target) / MEDIUM (causes debugging pain or subtle bugs)
- **Warning signs**: Observable symptoms before or after the problem manifests
- **Prevention**: Specific implementation action
- **Phase**: Which milestone phase should address this (Phase 1 = prototype pipeline)

---

## Part 1 — DCS Export.lua Pitfalls

These pitfalls are specific to DCS's Lua telemetry export system. They are the most project-specific and highest-risk for a developer unfamiliar with DCS modding.

---

### PITFALL-DCS-1: Export.lua Conflict With Other Installed Tools

**Severity:** CRITICAL

**What goes wrong:**
DCS only loads a single `Export.lua` file from `Saved Games\DCS\Scripts\Export.lua`. Many popular tools (Tacview, DCS-BIOS, SRS, SimRacingStudio) also install their own `Export.lua`. The last tool to install wins, silently breaking all previous tools. There is no native merge mechanism.

**Why it happens:**
Each third-party DCS application creates its own version of Export.lua in the same location, unaware of others. The DCS engine itself provides no hook registry or conflict resolution.

**Warning signs:**
- Telemetry bridge runs but never receives packets even though DCS is flying
- Tacview or SRS stops working after installing the JARVIS bridge
- `dcs.log` shows only one tool's export callbacks in the output

**Prevention:**
Use the `dofile()` chaining pattern — the canonical solution across the DCS community. Your `Export.lua` should **not** be a standalone script. Instead, append to any existing file using `dofile()`:

```lua
-- At the bottom of existing Export.lua, add:
local jarvisOk, jarvisErr = pcall(dofile, lfs.writedir() .. "Scripts\\jarvis\\jarvis_export.lua")
if not jarvisOk then
  log.write("JARVIS", log.ERROR, "Failed to load: " .. tostring(jarvisErr))
end
```

Your actual export logic lives in `Scripts\jarvis\jarvis_export.lua`. The installer script must detect an existing Export.lua and append rather than replace. Document this explicitly in setup instructions.

**Phase:** Phase 1 — Bridge Setup. This must be solved before any testing begins.

**Source:** [DCS Export Script Conflicts — ED Forums](https://forum.dcs.world/topic/252820-exportlua-conflicts/), [DCS-ExportScripts Documentation](https://github.com/s-d-a/DCS-ExportScripts/wiki/Documentation-in-English)

---

### PITFALL-DCS-2: Wrong "Saved Games" Path (DCS vs DCS.openbeta)

**Severity:** HIGH

**What goes wrong:**
DCS creates separate Saved Games folders for each variant:
- `%USERPROFILE%\Saved Games\DCS\` — for stable release
- `%USERPROFILE%\Saved Games\DCS.openbeta\` — for Open Beta

A user running Open Beta who installs the Export.lua into the `DCS\` folder will see no telemetry output at all. No error is shown; the sim simply ignores the file.

**Why it happens:**
DCS determines its Saved Games subfolder name from a `dcs_variant.txt` file in the installation directory. Users often don't know which variant they're running. Setup documentation that shows only `DCS\Scripts\` will silently fail for 40-60% of users (Open Beta is more common among active players).

**Warning signs:**
- Bridge receives no UDP packets despite DCS running a mission
- `dcs.log` does not mention the export script at all
- User confirms DCS is running but `Export.lua` has not been loaded

**Prevention:**
- The installer / setup wizard must detect both paths and offer the correct one, or install to both
- Document the distinction: "Open Beta users: use `DCS.openbeta`, Stable users: use `DCS`"
- During Phase 1 testing, always verify the path by checking the DCS log after mission load

**Phase:** Phase 1 — Documented in setup guide and installer script.

**Source:** [Stable vs Open Beta folder structure — ED Forums](https://forum.dcs.world/topic/343996-installation-stable-vs-open-beta-folders-structure-in-saved-games/), [DCS Export Documentation — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export)

---

### PITFALL-DCS-3: Export Callback Rate Not Guaranteed — LuaExportActivityNextEvent Reliability

**Severity:** HIGH

**What goes wrong:**
The standard pattern for rate-limiting exports is:

```lua
function LuaExportActivityNextEvent(t)
  local tNext = t
  tNext = tNext + 0.1  -- 10 Hz
  -- export logic here
  return tNext
end
```

However, `LuaExportActivityNextEvent` has been documented as unreliable across DCS updates. A 2019 DCS update (2.5.6.52437+) broke it for Helios, causing significantly fewer export calls than configured. The DCS developer community migrated to `LuaExportBeforeNextFrame` as the fallback.

**Warning signs:**
- Measured packet rate at Node.js bridge is far below 10 Hz despite Lua being configured for 0.1s intervals
- Rate varies wildly (2-3 Hz instead of 10 Hz) across DCS versions
- After a DCS update, telemetry stream slows down without any code changes

**Prevention:**
Use `LuaExportBeforeNextFrame` with manual rate-gating via `LoGetModelTime()`:

```lua
local JARVIS_lastExport = 0
local JARVIS_RATE = 0.1  -- 10 Hz

function LuaExportBeforeNextFrame()
  local t = LoGetModelTime()
  if (t - JARVIS_lastExport) >= JARVIS_RATE then
    JARVIS_lastExport = t
    -- export logic here
  end
end
```

This is independent of DCS's event scheduling and survives DCS version changes. Include a frame counter in exported packets so the Node.js bridge can measure actual received rate.

**Phase:** Phase 1 — Core Export.lua implementation decision.

**Source:** [DCS export.lua update rate broken — Helios Issue #288](https://github.com/HeliosVirtualCockpit/Helios/issues/288), [DCS export — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export)

---

### PITFALL-DCS-4: LoGetSelfData Returns Nil (Race Condition at Mission Start and Module Load)

**Severity:** CRITICAL

**What goes wrong:**
`LoGetSelfData()` can return `nil` in several legitimate scenarios:
- Mission is loading (callbacks fire before the aircraft model is ready)
- Brief moment after mission restart before the player unit is available
- Spectator slots (no player aircraft)
- Ground crew / observer modes

An Export.lua that does not guard against nil will crash the entire DCS telemetry export environment with a Lua error, stopping all exports for the session.

**Why it happens:**
The function is available in Export.lua scope but returns nil when there is no valid player unit. DCS calls `LuaExportAfterNextFrame` and `LuaExportBeforeNextFrame` even during loading transitions.

**Warning signs:**
- `dcs.log` shows Lua error: "attempt to index a nil value (local 'selfData')"
- Bridge stops receiving packets immediately after mission restarts or briefing screen appears
- Tacview or other concurrent exports also go silent (the entire export chain is broken)

**Prevention:**
Always nil-check before accessing any field:

```lua
local selfData = LoGetSelfData()
if selfData == nil then return end  -- aircraft not ready yet

-- Also nil-check nested fields
local ias_mps = selfData.IAS or 0
local altitude = selfData.altitude or 0
local heading = selfData.heading or 0
```

Wrap all export logic in `pcall()` so Lua errors do not break other tools chained via `dofile()`:

```lua
local ok, err = pcall(function()
  local selfData = LoGetSelfData()
  if not selfData then return end
  -- export logic
end)
if not ok then
  log.write("JARVIS", log.WARNING, "Export error: " .. tostring(err))
end
```

**Phase:** Phase 1 — First thing validated before declaring Export.lua stable.

**Source:** [DCS Export — Hoggit Wiki (LoGetSelfData)](https://wiki.hoggitworld.com/view/DCS_export), community pattern from [dcs_scripts export examples](https://github.com/sprhawk/dcs_scripts/blob/master/Export.lua)

---

### PITFALL-DCS-5: Unit Conversion — DCS Returns SI Units, Pilots Read Aviation Units

**Severity:** MEDIUM

**What goes wrong:**
All DCS export APIs return SI units by default:
- Speeds: meters per second (not knots)
- Altitude: meters (not feet)
- Angles: radians (not degrees)

If the dashboard displays raw SI values, a pilot will see "140 m/s IAS" instead of "272 KIAS" — the data is correct but the UI is unreadable. Worse, angle values in radians look like very small decimals, making debugging disorienting.

**Warning signs:**
- Dashboard shows IAS of ~100-200 (meters per second is plausible; knots would be 200-400 for typical ops)
- Heading shows 1.5 (radians) instead of 85 (degrees)
- All altitude values show ~3000-9000 (meters) instead of 10,000-30,000 (feet)

**Conversions required:**
```
IAS knots  = ias_mps * 1.943844
Altitude ft = alt_m * 3.28084
Heading deg = hdg_rad * 57.2958
Pitch deg   = pitch_rad * 57.2958
Bank deg    = bank_rad * 57.2958
AoA deg     = aoa_rad * 57.2958
```

**Prevention:**
Convert in the Lua script before transmission (reduces parsing in Node.js bridge), or document the wire format explicitly and convert in the bridge. Never convert in multiple places — choose one canonical conversion point. The DCS data catalogue in `documents/DCS_Gameplay_Data_Export_Catalogue.md` documents this.

**Phase:** Phase 1 — Establish the wire format specification before writing any parsing code.

**Source:** [DCS Gameplay Data Export Catalogue](../documents/DCS_Gameplay_Data_Export_Catalogue.md) (project document), [DCS Export — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export)

---

### PITFALL-DCS-6: Special Characters in DCS Data Crash JSON Encoding

**Severity:** MEDIUM

**What goes wrong:**
Eagle Dynamics uses non-UTF-8/ASCII characters in some internal identifiers (unit names, coalition names, airport names, etc.). Standard Lua JSON encoding will either crash or produce malformed JSON when it encounters these characters.

**Why it happens:**
Lua strings are byte arrays with no built-in encoding awareness. DCS internal strings sometimes contain Windows-1252 or other legacy encodings that are not valid UTF-8. Passing these directly to a JSON encoder without sanitization causes parse failures on the Node.js side.

**Warning signs:**
- Node.js bridge receives packets but `JSON.parse()` throws occasionally (not on every packet)
- Failures happen when flying over certain maps or using certain aircraft/object types
- Callsign or unit name fields correlate with the failures

**Prevention:**
Sanitize string fields before JSON encoding in Lua. Only pass known-safe numeric fields (IAS, ALT, HDG, lat/lon) for Phase 1. For string fields (unit type, callsign), apply a sanitization pass:

```lua
local function safe_string(s)
  if type(s) ~= "string" then return "" end
  return s:gsub("[^\32-\126]", "?")  -- ASCII printable only
end
```

In Node.js, wrap all `JSON.parse()` calls in try/catch and log malformed packets to a separate file rather than crashing.

**Phase:** Phase 1 — Handle in bridge packet parser from day one.

**Source:** [DCS character encoding — ED Forums](https://forum.dcs.world/topic/138477-dev-question-what-character-encoding-is-used-in-lua-environments-for-dcs/)

---

## Part 2 — UDP Pipeline Pitfalls

---

### PITFALL-UDP-1: Stale / Out-of-Order Packet Processing

**Severity:** HIGH

**What goes wrong:**
UDP provides no delivery ordering guarantees. At 10 Hz on localhost this is extremely rare, but during system load, the OS can reorder packets. If the bridge updates its "latest telemetry" state with an older packet arriving late, the dashboard briefly shows stale data then snaps to current data — producing a visible artifact or false "spike" on charts.

**Why it happens:**
The bridge processes packets in the order the OS delivers them from the socket buffer. With a busy DCS frame rate and a loaded Windows machine, brief reordering is possible on localhost UDP.

**Warning signs:**
- Telemetry values briefly spike backwards on charts then correct
- Altitude shows a momentary drop then recovery with no corresponding aircraft maneuver
- Model time (simulation timestamp) in packets is not monotonically increasing

**Prevention:**
Include `t_model` (DCS simulation time) in every packet. In the Node.js bridge, track the last-accepted model time and discard any packet with `t_model <= lastAcceptedTime`:

```javascript
let lastModelTime = -1;

socket.on('message', (msg) => {
  const packet = JSON.parse(msg);
  if (packet.t_model <= lastModelTime) {
    // stale or duplicate — discard
    return;
  }
  lastModelTime = packet.t_model;
  // forward to Supabase
});
```

**Phase:** Phase 1 — Include in bridge implementation from the start.

**Source:** [Reliable Ordered Messages — Gaffer On Games](https://gafferongames.com/post/reliable_ordered_messages/) (general UDP pattern, HIGH confidence)

---

### PITFALL-UDP-2: Socket Buffer Overflow Under Windows Load

**Severity:** MEDIUM

**What goes wrong:**
Windows assigns a default UDP receive buffer of 8 KB to new sockets. At 10 Hz with typical telemetry packet sizes (~500 bytes), this is usually fine. However, during DCS loading screens or heavy rendering moments, DCS may burst-send queued packets. If the Node.js event loop is momentarily blocked (e.g., during a Supabase reconnect), packets accumulate in the OS buffer and overflow, silently dropping the oldest packets.

**Warning signs:**
- Brief packet loss storms coincide with DCS map loading or terrain streaming events
- Bridge receives 0 packets for 200-500ms then resumes normally
- Packet/sec debug metric shows sudden drop-to-zero followed by a burst

**Prevention:**
Increase the socket receive buffer immediately after binding:

```javascript
const dgram = require('dgram');
const socket = dgram.createSocket('udp4');
socket.bind(PORT, '127.0.0.1', () => {
  socket.setRecvBufferSize(256 * 1024);  // 256 KB
  const actual = socket.getRecvBufferSize();
  console.log(`UDP buffer: ${actual} bytes`);
});
```

Note: On Windows, the OS may silently cap this at the socket's maximum (typically 64 KB or 128 KB depending on Windows version). Log the actual buffer size returned.

**Phase:** Phase 1 — Set in bridge initialization code.

**Source:** [Node.js dgram documentation](https://nodejs.org/api/dgram.html), [UDP packet loss investigation — nodejs/node](https://github.com/nodejs/node/issues/4199)

---

### PITFALL-UDP-3: Packet Size Exceeds MTU (Fragmentation and Silent Drop)

**Severity:** MEDIUM

**What goes wrong:**
UDP packets larger than the network MTU (~1500 bytes for Ethernet/localhost loopback on Windows) are fragmented at the IP layer. If any fragment is dropped, the entire reassembled packet is lost — silently, with no notification to the sender. At 10 Hz with rich telemetry, a single packet can reach 800-1200 bytes as more fields are added. On the Phase 1 prototype this is within safe range, but Phase 2+ payloads (adding weapon states, sensor data, world objects) can push past MTU.

**Warning signs:**
- Adding more fields to the telemetry payload causes packet loss to increase
- Packet sizes logged at bridge show occasional near-MTU sizes

**Prevention:**
For Phase 1 (IAS, ALT, HDG + position/attitude only), keep payloads well under 1024 bytes. Log actual serialized packet size in the Lua script as a development metric. If fields grow, compress by removing redundant precision (2 decimal places for altitude in feet is sufficient; 8 decimal places wastes space).

On localhost (127.0.0.1), the loopback MTU is typically 65,535 bytes — fragmentation is only a risk when sending to a remote machine. For the Phase 1 architecture (localhost only), this is LOW severity, but it becomes HIGH if the bridge is ever moved off-machine.

**Phase:** Phase 1 awareness; becomes implementation concern if architecture changes.

**Source:** [Node.js dgram UDP max packet size](https://github.com/nodejs/node-v0.x-archive/issues/1623)

---

## Part 3 — Supabase Realtime Pitfalls

---

### PITFALL-SUPABASE-1: Free Tier Rate Limit Makes 10 Hz Passthrough Impossible

**Severity:** CRITICAL

**What goes wrong:**
Supabase Realtime free tier enforces a hard limit of **100 messages per second** (project-wide). At 10 Hz telemetry with even a single active session, the bridge would consume 10 msg/sec (about 10% of the limit). This sounds safe, but consider:

- 10 Hz × 1 session × 60 seconds × 60 minutes × 20 minutes = **120,000 messages per session**
- Monthly free tier quota: **2,000,000 messages**
- At 10 Hz continuous for 8 hours/day: ~2,880,000 messages/month — **exceeds free tier**

For Phase 1 (short test sessions, single user), the rate limit itself is not hit. But if the project runs unattended background tests or multiple sessions, the monthly cap will be exceeded and **messages are silently dropped** (not queued, not returned, just gone).

**Warning signs:**
- Dashboard stops receiving updates mid-flight without the bridge showing any errors
- Supabase Dashboard → Realtime → Messages shows usage approaching 2M
- No error is surfaced client-side; the channel appears subscribed but data stops arriving

**Prevention:**
Implement **downsampling in the bridge**: DCS sends 10 Hz, bridge publishes at 2-5 Hz to Supabase. 5 Hz is sufficient for a human-readable dashboard and reduces monthly message count by 50-75%. Expose the publish rate as a configurable parameter so it can be tuned independently of the DCS export rate.

```javascript
const PUBLISH_RATE_HZ = 2;  // 2 Hz to Supabase (configurable)
const PUBLISH_INTERVAL_MS = 1000 / PUBLISH_RATE_HZ;
let lastPublish = 0;

function onPacketReceived(telemetry) {
  const now = Date.now();
  if (now - lastPublish >= PUBLISH_INTERVAL_MS) {
    lastPublish = now;
    channel.send({ type: 'broadcast', event: 'telemetry', payload: telemetry });
  }
}
```

Monitor usage in Supabase Dashboard. Add a monthly usage counter to the debug panel.

**Phase:** Phase 1 — Must be in the bridge from the first commit.

**Source:** [Supabase Realtime Limits — Official Docs](https://supabase.com/docs/guides/realtime/limits), [Supabase Realtime Pricing — Official Docs](https://supabase.com/docs/guides/realtime/pricing)

---

### PITFALL-SUPABASE-2: Broadcast Message Size Limit on Free Tier (256 KB)

**Severity:** MEDIUM

**What goes wrong:**
Supabase Realtime Broadcast messages on the free tier are capped at **256 KB per message**. Pro tier raises this to 3,000 KB. Phase 1 telemetry packets (a few hundred bytes) are far under this limit. However, if the bridge ever batches multiple packets into a single broadcast (as an optimization attempt), or if Phase 2 adds rich event payloads (weapon release sequences, sensor tracks, world object snapshots), this limit can be reached.

**Warning signs:**
- Supabase silently rejects oversized messages (no error propagated to client by default)
- Dashboard receives some messages but occasionally misses packets correlating with larger payloads

**Prevention:**
Keep telemetry broadcasts minimal and structured. For Phase 1, the JSON payload should include only the fields needed by the dashboard. Establish a maximum payload size target of 4 KB per message as a development constraint. Log payload sizes in the bridge during development.

**Phase:** Phase 1 awareness; Phase 2 must audit payload sizes before adding sensor/event data.

**Source:** [Supabase Realtime Limits — Official Docs](https://supabase.com/docs/guides/realtime/limits)

---

### PITFALL-SUPABASE-3: Channel Reconnection After Disconnect Does Not Auto-Restore

**Severity:** HIGH

**What goes wrong:**
Supabase Realtime uses a Phoenix WebSocket protocol with a 60-second heartbeat timeout. When the client (browser or bridge Node.js) loses connectivity for more than 60 seconds — or when a browser tab is backgrounded for more than 5 minutes (triggering browser timer throttling) — the channel enters a CLOSED or TIMED_OUT state. Crucially, **channels are not automatically rejoined after reconnection** in all client versions. The application must explicitly handle this.

Reported behavior from production users: reconnection gets stuck in a loop; channels show CLOSED status but `supabase-js` does not recover without manual intervention.

**Warning signs:**
- Dashboard subscribes successfully on page load but stops updating after browser is minimized for several minutes
- On restoring the tab, connection status shows "Reconnecting" indefinitely
- The bridge's Supabase client shows CLOSED but no error event fires

**Prevention:**
Implement explicit visibility-based reconnection using the Page Visibility API on the dashboard:

```javascript
import { supabase } from '@/lib/supabase';

document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') {
    // Force reconnect by removing and recreating the channel
    supabase.removeAllChannels();
    subscribeToTelemetry();  // your subscription setup function
  }
});
```

On the bridge side (Node.js), implement exponential-backoff reconnect on Supabase channel errors:

```javascript
channel.on('system', {}, (payload) => {
  if (payload.status === 'error' || payload.status === 'closed') {
    scheduleReconnect();
  }
});
```

Include a visible "Reconnecting..." state in the dashboard's connection indicator so users know when this is happening.

**Phase:** Phase 1 — The connection status indicator requirement in PROJECT.md explicitly calls for this.

**Source:** [Supabase Realtime WebSocket background disconnect — Issue #121](https://github.com/supabase/realtime-js/issues/121), [Auto reconnect discussion — supabase/supabase #27513](https://github.com/orgs/supabase/discussions/27513)

---

### PITFALL-SUPABASE-4: Session Channel Namespace Collision (Security + Isolation)

**Severity:** HIGH

**What goes wrong:**
If channel names are predictable (e.g., `telemetry:user123`), another user who knows or guesses the channel name can subscribe to it and receive live telemetry from another pilot. In Phase 1 the data is not sensitive (IAS/ALT/HDG), but the pattern is wrong for Phase 2+ where coaching data and session records are involved.

Additionally, if the bridge and web client use different channel name schemes (due to a coding inconsistency), the dashboard silently receives zero messages while the bridge publishes successfully — a debugging nightmare.

**Warning signs:**
- Dashboard shows "Connected" but never receives a telemetry packet
- Changing any field in channel naming logic causes complete silence

**Prevention:**
Use a cryptographically random session ID (UUID v4) as the channel name:

```javascript
// Session created server-side, stored in Supabase sessions table
const sessionId = crypto.randomUUID();  // Node.js built-in, no dependency
const channelName = `session:${sessionId}`;
```

The pairing code mechanism (short-lived 5-minute code) in PROJECT.md should link to this UUID, not expose the UUID itself to the user. The short code is human-readable; the UUID is the actual authorization token. Validate that the bridge's channel name matches exactly what the dashboard subscribes to — log both on startup.

**Phase:** Phase 1 — Implement from the first session pairing prototype.

**Source:** Project requirements (PROJECT.md, security constraints section)

---

## Part 4 — Vercel / Next.js Deployment Pitfalls

---

### PITFALL-VERCEL-1: No WebSocket Support on Vercel — Architectural Constraint

**Severity:** CRITICAL (architecture decision, not a coding bug)

**What goes wrong:**
Vercel Serverless Functions do not support persistent WebSocket connections. Vercel's architecture is stateless request/response — functions terminate after sending a response. Any attempt to open a WebSocket from a Vercel API route will fail or be severed at the function timeout.

This means the **dashboard cannot run its own WebSocket server**. It must use Supabase Realtime (or another external service) as its real-time transport. This is correct in the current architecture, but it must be understood explicitly — a developer who tries to optimize by "cutting out Supabase" and connecting the bridge directly to a Vercel endpoint will fail.

**Warning signs:**
- Attempts to use `ws` library or native WebSocket server in a Next.js API route
- Bridge cannot reach Vercel endpoint persistently

**Prevention:**
This constraint is correctly addressed by the architecture: Supabase Realtime is the pub/sub layer. The constraint only becomes a pitfall if someone tries to bypass it. Document it in the architecture decision log. The bridge must always publish to Supabase — never attempt direct HTTP polling to Vercel.

**Phase:** Architecture constraint established before Phase 1 begins.

**Source:** [Vercel WebSocket Support — Official Docs](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)

---

### PITFALL-VERCEL-2: Cold Start Latency Breaks the 500ms Latency Budget

**Severity:** HIGH

**What goes wrong:**
Vercel Hobby plan Serverless Functions cold start on first invocation after idle (typically 2-3 seconds). If the user loads the dashboard after the function has been idle (e.g., first morning load, or after 10+ minutes of inactivity), the first API call experiences a cold start. If this API call is on the critical path to displaying telemetry (e.g., session validation, fetching initial state), it adds 2-3 seconds to the initial load — violating the <500ms latency target.

**Warning signs:**
- Dashboard works fast once loaded but the first load after inactivity is noticeably slow (2-3 second blank screen)
- Session validation API call takes 2-3 seconds on first load, <100ms on subsequent calls
- Users complain dashboard is "slow to start"

**Prevention:**
- Keep the critical path (Supabase Realtime subscription initiation) client-side only, not gated on a Vercel API call
- Initial session validation should use the Supabase client directly (not via a Vercel API route) where possible
- If API routes are needed for auth, ensure NextAuth.js session tokens are cached client-side so subsequent calls are fast
- Consider enabling Vercel Fluid Compute (available on Hobby) which keeps at least one instance warm

**Phase:** Phase 1 — Validate latency budget in test cases D1-D6 from JARVIS_DCS_Prototype_Test_Plan.md.

**Source:** [Vercel cold start solutions — Official KB](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel), [Fluid Compute blog post](https://vercel.com/blog/scale-to-one-how-fluid-solves-cold-starts)

---

### PITFALL-VERCEL-3: Vercel Function Request Body Size Limit (4.5 MB)

**Severity:** LOW for Phase 1, MEDIUM for Phase 2+

**What goes wrong:**
Vercel Functions reject request bodies larger than 4.5 MB with HTTP 413. For Phase 1 telemetry (small JSON payloads), this is not a concern. However, if Phase 2 adds session replay uploads, bulk event batch uploads, or base64-encoded screenshots, payloads can exceed this limit.

**Prevention:**
Use Supabase Storage or direct-to-S3 uploads for large payloads instead of routing through Vercel API routes. Stream large data sets rather than batching.

**Phase:** Phase 2 awareness.

**Source:** [Vercel Functions Limits — Official Docs](https://vercel.com/docs/functions/limitations)

---

## Part 5 — NextAuth.js + Supabase Integration Pitfalls

---

### PITFALL-AUTH-1: NEXTAUTH_SECRET Missing in Production (Silent JWT Failure)

**Severity:** CRITICAL

**What goes wrong:**
Without `NEXTAUTH_SECRET` set in Vercel environment variables, NextAuth.js cannot encrypt/decrypt JWT session tokens. In development, `next dev` generates a temporary secret automatically. When deployed to Vercel without the variable, all session cookies are invalid — users cannot log in, or appear logged in but session callbacks fail silently.

**Warning signs:**
- App works locally but all users are logged out immediately on Vercel
- NextAuth logs show "JWT decrypt error" or "Invalid signature"
- Google OAuth redirect succeeds but the session is not established

**Prevention:**
Generate a secret before first deployment:
```bash
openssl rand -base64 32
```
Add to Vercel: Settings → Environment Variables → `NEXTAUTH_SECRET`. Also required: `NEXTAUTH_URL` must be set to the production domain (`https://your-app.vercel.app`). Verify both are set in all environments (preview and production).

**Phase:** Phase 1 — Must be configured before first Vercel deployment.

**Source:** [NextAuth.js Session Management — Clerk analysis](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues)

---

### PITFALL-AUTH-2: NextAuth.js Credentials Provider + Supabase RLS Incompatibility

**Severity:** HIGH

**What goes wrong:**
The project uses NextAuth.js for Google OAuth (not Supabase Auth). This means Supabase Row Level Security (RLS) policies that rely on `auth.uid()` (Supabase Auth UID) will not work correctly — because the user is authenticated by NextAuth, not Supabase Auth. The `supabase.auth.getUser()` will return `null` for NextAuth sessions.

**Why it happens:**
Supabase RLS `auth.uid()` function reads from the Supabase Auth JWT, which is only populated when using Supabase Auth's own login flow. NextAuth generates its own JWT independently.

**Warning signs:**
- Supabase queries succeed in development (using service role key) but fail for users in production (using anon key)
- RLS policies appear to block all reads/writes even for authenticated users
- `supabase.auth.getUser()` returns null inside the dashboard

**Prevention:**
For this architecture (NextAuth + Supabase), use one of two approaches:
1. **Use Supabase service role key on the server side only** (in Vercel API routes/Server Actions where NextAuth session is verified first), and use anon key on client side with no RLS.
2. **Or mint a Supabase JWT from the NextAuth session** using a custom JWT claim. See the [Auth.js Supabase adapter](https://authjs.dev/getting-started/adapters/supabase) for the integration pattern.

For Phase 1 prototype scope, approach 1 is simpler: use the service role key in server components/API routes with manual session validation from NextAuth, and disable RLS during prototype (re-enable with proper integration for Phase 2).

**Phase:** Phase 1 — Architectural decision must be made before the first API route that touches Supabase.

**Source:** [Auth.js Supabase adapter — Official Docs](https://authjs.dev/getting-started/adapters/supabase), [Supabase Auth + Next.js App Router](https://supabase.com/docs/guides/auth/server-side/nextjs)

---

## Part 6 — Bridge Process Stability Pitfalls

---

### PITFALL-BRIDGE-1: Memory Leak from Uncleared Packet Accumulation

**Severity:** HIGH

**What goes wrong:**
A long-running Node.js bridge that accumulates telemetry in memory without bounded cleanup will grow unboundedly. Common patterns that cause this:
- Keeping a `packetHistory[]` array without a max size limit
- Attaching event listeners inside the UDP message handler without removing them
- Buffering Supabase messages in a queue without draining when the connection drops

At 10 Hz for a 20-minute session = 12,000 packets. If each packet is stored for any reason, and if objects accumulate (listeners, closures), the process can exhaust available memory over a flight session.

**Warning signs:**
- `process.memoryUsage().heapUsed` grows monotonically during a session
- After 20-30 minutes, bridge becomes unresponsive or crashes with `ENOMEM`
- Debug panel's memory metric (if added) shows steady increase over time

**Prevention:**
- Use a fixed-size ring buffer for any in-memory packet history (e.g., last 100 packets max)
- Only track aggregate statistics (packets/sec, last packet timestamp), not raw packet history
- Add `socket.setMaxListeners(10)` and verify listener counts are stable over time
- Run `node --inspect` during testing and take heap snapshots at 0, 5, and 20 minutes; compare

PROJECT.md explicitly requires "No memory growth in a 20-minute session" — this is a test case requirement, not just a nice-to-have.

**Phase:** Phase 1 — Include memory validation in test plan (test case D5 per JARVIS_DCS_Prototype_Test_Plan.md).

**Source:** [Node.js Memory Leaks — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/high-performance-nodejs/nodejs-memory-leaks/), [UDP socket memory leak — nodejs/node #6189](https://github.com/nodejs/node/issues/6189)

---

### PITFALL-BRIDGE-2: Bridge Has No Crash Recovery on Windows

**Severity:** HIGH

**What goes wrong:**
The Node.js bridge process is a long-running daemon on Windows. If it crashes (unhandled exception, ENOMEM, network error), it stays crashed until the user manually restarts it. DCS continues flying but no telemetry reaches the dashboard. The user sees the dashboard go offline but may assume it's a network issue rather than a dead bridge process.

**Warning signs:**
- Bridge process disappears from Task Manager
- Dashboard shows "Offline" status and never recovers without user restart
- Windows Event Viewer shows Node.js crash events

**Prevention:**
For Phase 1, use PM2 (Node.js process manager) to run the bridge:
```bash
npm install -g pm2
pm2 start bridge.js --name jarvis-bridge --max-restarts 5 --min-uptime 5s
pm2 save
pm2 startup  # generates Windows startup command
```

PM2 provides:
- Automatic restart on crash with exponential backoff
- Log file rotation (prevents disk fill from runaway logging)
- Process health monitoring

Alternatively, add a top-level `uncaughtException` handler to log the crash state before exiting:
```javascript
process.on('uncaughtException', (err) => {
  logger.error('Fatal crash', err);
  // flush logs synchronously before exiting
  process.exit(1);
});
```

**Phase:** Phase 1 — Required to pass the 20-minute stability test.

**Source:** [PM2 — Official Documentation](https://pm2.io/), [PM2 restart strategies](https://pm2.keymetrics.io/docs/usage/restart-strategies/)

---

### PITFALL-BRIDGE-3: No Graceful Handling of DCS Exporter Going Silent

**Severity:** HIGH

**What goes wrong:**
DCS stops sending UDP packets in two scenarios:
1. Mission ends or player exits to the menu (LuaExportStop is called, socket closed)
2. DCS crashes or is killed (socket closes abruptly, no notification to Node.js bridge)

In both cases, the Node.js UDP socket simply stops receiving messages. The bridge has no way to distinguish "DCS paused briefly" from "DCS stopped entirely." Without a watchdog, the dashboard shows stale data indefinitely without any offline indicator.

**Warning signs:**
- Dashboard continues to show last telemetry values with no "stale data" warning
- Packet rate drops to 0 but connection status stays "Connected"
- User finishes flying but dashboard never shows the session as ended

**Prevention:**
Implement a staleness watchdog: if no UDP packet has been received for N seconds, transition to a "DCS Offline" state and publish this state to the Supabase channel:

```javascript
const STALE_TIMEOUT_MS = 3000;  // 3 seconds = 30 missed 10Hz packets
let lastPacketTime = Date.now();

socket.on('message', (msg) => {
  lastPacketTime = Date.now();
  bridgeState = 'CONNECTED';
  // process packet
});

setInterval(() => {
  const msSinceLastPacket = Date.now() - lastPacketTime;
  if (msSinceLastPacket > STALE_TIMEOUT_MS && bridgeState !== 'DCS_OFFLINE') {
    bridgeState = 'DCS_OFFLINE';
    publishStatus({ status: 'dcs_offline', lastPacketAgeMs: msSinceLastPacket });
  }
}, 1000);
```

**Phase:** Phase 1 — Explicitly required by PROJECT.md: "Bridge handles DCS exporter stopping gracefully."

**Source:** General real-time system pattern (HIGH confidence); PROJECT.md requirement

---

## Part 7 — Browser / Dashboard Pitfalls

---

### PITFALL-BROWSER-1: Tab Throttling Kills WebSocket Heartbeat

**Severity:** HIGH

**What goes wrong:**
Chrome, Edge, and Firefox all implement aggressive timer throttling for backgrounded tabs. Specifically:
- After a tab has been hidden for **5 minutes**, JavaScript timers run **at most once per minute**
- This breaks the 60-second WebSocket heartbeat that keeps Supabase Realtime channels alive
- The Supabase server disconnects the channel after 60 seconds without a heartbeat
- When the user returns to the tab, the channel is in CLOSED state and must be reconnected

The Supabase `realtime-js` client library confirmed this behavior in [Issue #121](https://github.com/supabase/realtime-js/issues/121).

**Warning signs:**
- Dashboard works perfectly when tab is focused but shows Offline after being minimized for >5 min
- Reconnect loop on tab restoration
- Safari is worse than Chrome — closes connections exactly at 5 minutes

**Prevention:**
Use the Page Visibility API to proactively manage subscriptions:

```javascript
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'hidden') {
    // Tab hidden — disconnect gracefully rather than letting server time out
    supabase.removeAllChannels();
    setConnectionStatus('paused');
  } else if (document.visibilityState === 'visible') {
    // Tab restored — reconnect
    reconnectTelemetry();
    setConnectionStatus('reconnecting');
  }
});
```

The dashboard's connection status indicator (required in Phase 1) must clearly distinguish between these states: Connected / DCS Offline / Tab Paused / Reconnecting.

**Phase:** Phase 1 — Required for the connection status indicator to be meaningful.

**Source:** [Supabase Realtime background tab issue — realtime-js #121](https://github.com/supabase/realtime-js/issues/121), [Browser Tab Throttling — Chromium Blog](https://blog.chromium.org/2020/11/tab-throttling-and-more-performance.html)

---

### PITFALL-BROWSER-2: Dashboard Displays Stale Data Without Age Indicator

**Severity:** MEDIUM

**What goes wrong:**
When telemetry stops (DCS offline, bridge crashed, internet drop), the dashboard continues to display the last received values without any indication they are stale. A pilot looking at a frozen IAS of 245 KIAS may not realize they are looking at data from 30 seconds ago.

**Warning signs:**
- Connection status shows "Offline" but telemetry cards still show old numbers
- Users ask "is this live?" because they cannot tell

**Prevention:**
Add a "last updated N seconds ago" label to each telemetry card, or add a visual indicator (e.g., card border color shifts from green to yellow to red as data ages). Use `Date.now()` compared to the timestamp of the last received packet:

```javascript
const [lastUpdateAge, setLastUpdateAge] = useState(0);

useEffect(() => {
  const interval = setInterval(() => {
    setLastUpdateAge(Date.now() - lastPacketTimestamp);
  }, 500);
  return () => clearInterval(interval);
}, [lastPacketTimestamp]);
```

**Phase:** Phase 1 — Part of the debug panel requirement (last packet time is already in scope per PROJECT.md).

---

## Part 8 — Session Pairing Pitfalls

---

### PITFALL-PAIRING-1: Short Code Brute Force and Timing Attacks

**Severity:** MEDIUM for Phase 1 (single user, private testing), HIGH for multi-user Phase 4+

**What goes wrong:**
If pairing codes are 4-6 character alphanumeric codes with a 5-minute expiry, an attacker who can enumerate codes (e.g., by polling a validation endpoint) could enumerate all ~36^5 = 60 million possibilities within the 5-minute window using a botnet. In Phase 1 (single user, private testing), this is theoretical. For Phase 4+ (multi-user, commercial), it becomes a real attack surface.

**Warning signs:**
- Unusual number of failed pairing code validation attempts in server logs
- Bridge connects to another user's session

**Prevention:**
For Phase 1:
- Use 8-character codes (alphanumeric, case-sensitive): 62^8 = ~218 trillion possibilities — brute-force infeasible
- Rate-limit the pairing code validation endpoint (e.g., 10 attempts per IP per minute) using Supabase Edge Functions or Vercel middleware
- Codes are single-use: once a bridge authenticates, the code is invalidated immediately (not just at expiry)

**Phase:** Phase 1 — Basic rate limiting and single-use enforcement. More thorough security audit in Phase 4.

**Source:** [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)

---

### PITFALL-PAIRING-2: Race Condition in Code Generation (Same Code Issued Twice)

**Severity:** MEDIUM

**What goes wrong:**
If two browser tabs (or a browser and a script) both generate a pairing code at the same moment, and the code generation uses a predictable algorithm without proper DB-level uniqueness enforcement, both could receive the same code. The second bridge to authenticate with that code would connect to the first user's session.

**Warning signs:**
- Two devices occasionally connect to each other's sessions unexpectedly
- Logs show the same pairing code used by two different clients

**Prevention:**
Generate codes via the database with a `UNIQUE` constraint on the active codes table, not via client-side logic. Let the database enforce uniqueness:

```sql
CREATE TABLE pairing_codes (
  code TEXT PRIMARY KEY,
  session_id UUID NOT NULL,
  user_id UUID NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);
```

Use `INSERT OR RETRY` semantics in the server-side code — if the INSERT fails due to collision, generate a new code and retry (max 3 attempts before surfacing an error).

**Phase:** Phase 1 — Must be implemented correctly from day one.

---

## Phase-Specific Warning Summary

| Phase Topic | Most Likely Pitfall | Mitigation | Severity |
|-------------|-------------------|------------|----------|
| Export.lua installation | PITFALL-DCS-1 (conflict) | dofile chaining | CRITICAL |
| Export.lua path | PITFALL-DCS-2 (DCS vs DCS.openbeta) | Detect both paths | HIGH |
| Export rate | PITFALL-DCS-3 (LuaExportActivityNextEvent) | Use LuaExportBeforeNextFrame | HIGH |
| Export parsing | PITFALL-DCS-4 (nil LoGetSelfData) | nil-check + pcall | CRITICAL |
| Wire format | PITFALL-DCS-5 (SI unit confusion) | Document conversions | MEDIUM |
| Packet encoding | PITFALL-DCS-6 (special chars) | Sanitize strings | MEDIUM |
| UDP ordering | PITFALL-UDP-1 (stale packets) | t_model sequence check | HIGH |
| UDP buffering | PITFALL-UDP-2 (buffer overflow) | setRecvBufferSize | MEDIUM |
| Supabase rate | PITFALL-SUPABASE-1 (10 Hz over limit) | Downsample to 2-5 Hz | CRITICAL |
| Supabase reconnect | PITFALL-SUPABASE-3 (no auto-rejoin) | Visibility API + manual reconnect | HIGH |
| Session isolation | PITFALL-SUPABASE-4 (channel collision) | UUID channel names | HIGH |
| Vercel architecture | PITFALL-VERCEL-1 (no WebSocket) | Use Supabase (already correct) | CRITICAL |
| Cold start | PITFALL-VERCEL-2 (2-3s latency) | Fluid Compute + client-side Supabase | HIGH |
| Auth secret | PITFALL-AUTH-1 (NEXTAUTH_SECRET) | Set env var before first deploy | CRITICAL |
| Auth RLS | PITFALL-AUTH-2 (RLS + NextAuth gap) | Service role on server only | HIGH |
| Memory leak | PITFALL-BRIDGE-1 (packet accumulation) | Ring buffer + 20min test | HIGH |
| Bridge crash | PITFALL-BRIDGE-2 (no recovery) | PM2 process manager | HIGH |
| DCS silence | PITFALL-BRIDGE-3 (no watchdog) | Staleness timer + publish status | HIGH |
| Tab throttling | PITFALL-BROWSER-1 (WebSocket heartbeat) | Visibility API + reconnect | HIGH |
| Stale data display | PITFALL-BROWSER-2 (no age indicator) | Last updated timestamp | MEDIUM |
| Pairing code brute force | PITFALL-PAIRING-1 | 8-char codes + rate limit | MEDIUM |
| Code uniqueness | PITFALL-PAIRING-2 (race condition) | DB UNIQUE constraint | MEDIUM |

---

## What Needs Phase-Specific Deep Research Later

1. **Phase 2 — Event streaming**: Adding discrete events (takeoff, weapons release, gate entry) changes the Supabase message pattern. Research the Postgres Changes subscription pattern vs Broadcast for events. Broadcast is fire-and-forget (can miss events during reconnect); Postgres Changes are durable. Choose the right pattern for each event type.

2. **Phase 2 — Mission scripting security sandbox**: The DCS mission scripting environment is sandboxed by default. Enabling `io` or `socket` requires setting `MissionScripting.lua` to disable the sandbox — a security risk on shared machines. Phase 2 must research whether the Export.lua + flag-polling approach (documented in DCS_Gameplay_Data_Export_Catalogue.md) is sufficient to avoid touching the sandbox at all.

3. **Phase 3 — DCS injection (outText, sounds)**: Writing data back to DCS from the bridge requires the UDP receive socket in Export.lua (port 12801 by convention). This introduces a new attack surface and may be blocked by DCS's sanitized execution environment depending on version. Deep research required before Phase 3 design.

4. **Phase 4 — Supabase free tier scaling**: Multiple concurrent user sessions at 2 Hz = 120 msg/min × N users. At 100 users, the free tier (100 msg/sec = 6,000 msg/min) is saturated. Upgrade to Pro ($25/month) at approximately 50 concurrent active sessions. Plan this threshold before Phase 4.

---

## Sources

- [DCS Export — Hoggit World Wiki](https://wiki.hoggitworld.com/view/DCS_export)
- [DCS Export Script Conflicts — ED Forums](https://forum.dcs.world/topic/252820-exportlua-conflicts/)
- [DCS-ExportScripts Documentation — GitHub](https://github.com/s-d-a/DCS-ExportScripts/wiki/Documentation-in-English)
- [DCS stable vs openbeta folder structure — ED Forums](https://forum.dcs.world/topic/343996-installation-stable-vs-open-beta-folders-structure-in-saved-games/)
- [Helios Issue #288 — export rate broken by DCS update](https://github.com/HeliosVirtualCockpit/Helios/issues/288)
- [Supabase Realtime Limits — Official Docs](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime Pricing — Official Docs](https://supabase.com/docs/guides/realtime/pricing)
- [Supabase Realtime WebSocket background disconnect — Issue #121](https://github.com/supabase/realtime-js/issues/121)
- [Supabase Realtime auto-reconnect discussion — #27513](https://github.com/orgs/supabase/discussions/27513)
- [Vercel Functions Limitations — Official Docs](https://vercel.com/docs/functions/limitations)
- [Vercel WebSocket support — Official KB](https://vercel.com/kb/guide/do-vercel-serverless-functions-support-websocket-connections)
- [Vercel cold start performance — Official KB](https://vercel.com/kb/guide/how-can-i-improve-serverless-function-lambda-cold-start-performance-on-vercel)
- [Auth.js Supabase adapter — Official Docs](https://authjs.dev/getting-started/adapters/supabase)
- [NextAuth session management — Clerk analysis 2025](https://clerk.com/articles/nextjs-session-management-solving-nextauth-persistence-issues)
- [Node.js dgram documentation](https://nodejs.org/api/dgram.html)
- [Node.js memory leaks — Better Stack](https://betterstack.com/community/guides/scaling-nodejs/high-performance-nodejs/nodejs-memory-leaks/)
- [PM2 process manager](https://pm2.io/)
- [Browser tab throttling — Chromium Blog](https://blog.chromium.org/2020/11/tab-throttling-and-more-performance.html)
- [OWASP Session Management Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Session_Management_Cheat_Sheet.html)
- [Reliable Ordered Messages over UDP — Gaffer On Games](https://gafferongames.com/post/reliable_ordered_messages/)
- [DCS character encoding — ED Forums](https://forum.dcs.world/topic/138477-dev-question-what-character-encoding-is-used-in-lua-environments-for-dcs/)
- [DCS Gameplay Data Export Catalogue — Project Document](../documents/DCS_Gameplay_Data_Export_Catalogue.md)
