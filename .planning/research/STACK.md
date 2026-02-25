# Technology Stack — JARVIS DCS Telemetry Dashboard

**Project:** JARVIS DCS Companion (Phase 1 Prototype)
**Researched:** 2026-02-25
**Research mode:** Ecosystem + Verification

---

## Recommended Stack (Quick Reference)

| Layer | Technology | Version | Confidence |
|-------|-----------|---------|-----------|
| Web framework | Next.js (App Router) | 15.x (stable) | HIGH |
| Hosting | Vercel Hobby | current | HIGH |
| Realtime pub/sub | Supabase Realtime Broadcast | supabase-js 2.97.x | HIGH |
| Database | Supabase Postgres | managed | HIGH |
| Auth | NextAuth.js / Auth.js | v5 beta (5.0.0-beta.30) | MEDIUM |
| UI components | shadcn/ui | current CLI | HIGH |
| CSS | Tailwind CSS | v4.x | HIGH |
| Bridge runtime | Node.js | 22.x (Maintenance LTS) | HIGH |
| Bridge UDP | node:dgram | built-in | HIGH |
| Bridge HTTP client | node-fetch / native fetch | built-in (Node 22) | HIGH |
| DCS hook | Export.lua | DCS-bundled Lua 5.1 | HIGH |
| DCS networking | LuaSocket 2.0 Beta | DCS-bundled | HIGH |
| DCS JSON | Scripts/JSON.lua (loadfile) | DCS-bundled | MEDIUM |
| TypeScript | TypeScript | 5.x | HIGH |

---

## Layer 1: DCS Export (Game Side)

### How Export.lua Works

DCS activates `Saved Games\DCS\Scripts\Export.lua` on every mission start. Four callback hooks are available:

| Callback | When Called | Use |
|----------|-------------|-----|
| `LuaExportStart()` | Before mission starts | Initialize UDP socket |
| `LuaExportBeforeNextFrame()` | Before each simulation frame | Inject commands (not needed for Phase 1) |
| `LuaExportAfterNextFrame()` | After each simulation frame | Read telemetry, send UDP |
| `LuaExportStop()` | After mission quits | Close socket, cleanup |

DCS runs at ~60 fps internally. To achieve 10 Hz telemetry, throttle with a frame counter or timer check inside `LuaExportAfterNextFrame`.

### Key LoGet* Functions for Telemetry

All return values are in SI units (m/s, meters, radians). **Convert in the bridge or Lua before sending.**

| Function | Returns | Units | Notes |
|----------|---------|-------|-------|
| `LoGetIndicatedAirSpeed()` | number | m/s | Multiply by 1.944 for knots |
| `LoGetAltitudeAboveSeaLevel()` | number | meters | Multiply by 3.281 for feet |
| `LoGetMagneticYaw()` | number | radians | Multiply by 57.296 for degrees; 0 = North |
| `LoGetADIPitchBankYaw()` | 3 numbers | radians | Returns pitch, bank, yaw separately |
| `LoGetSelfData()` | table | mixed | Heading (rad), Pitch (rad), Bank (rad), Position {x,y,z}, LatLongAlt {Lat, Long, Alt}, Name, Type, CoalitionID, UnitName, Flags |
| `LoGetModelTime()` | number | seconds | Current mission time |
| `LoGetAccelerationUnits()` | table {x,y,z} | G-force | For G-meter display |

**Recommendation:** Use individual `LoGet*` functions for IAS, altitude, and heading rather than `LoGetSelfData()` for cleaner data. `LoGetSelfData()` is most useful for position (LatLongAlt) and aircraft identity (Name).

### LuaSocket — UDP Transport

DCS bundles LuaSocket 2.0 Beta at `Scripts/LuaSocket/`. Add to package path before `require("socket")`:

```lua
package.path  = package.path  .. ";.\\LuaSocket\\?.lua"
package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"
local socket  = require("socket")
```

Use UDP (not TCP) for telemetry — connectionless, zero handshake overhead, appropriate for fire-and-forget 10 Hz updates:

```lua
local udp = socket.udp()
udp:settimeout(0)  -- non-blocking
```

### JSON Encoding in Export.lua

DCS bundles a JSON library at `Scripts/JSON.lua` (Jeffrey Friedl's implementation, commonly referenced in community Export.lua scripts). Load with `loadfile`:

```lua
local JSON = loadfile([[Scripts\JSON.lua]])()
```

If that path fails (DCS version dependent), use `net.lua2json()` which is available in the mission scripting environment (introduced DCS 2.5.0). However, `net.lua2json()` is in the Net API scope — **test which is available in your Export.lua context**. As a fallback, use a lightweight pure-Lua JSON encoder bundled alongside your Export.lua.

**Confidence: MEDIUM** — The presence of `Scripts/JSON.lua` is widely reported by community scripts (jboecker/dcs-witchcraft, jboecker/dcs-export-core), but it is not officially documented by Eagle Dynamics. Test on your DCS installation.

### Complete Export.lua Pattern

```lua
-- Export.lua — JARVIS Telemetry Exporter
-- Place in: Saved Games\DCS\Scripts\Export.lua

package.path  = package.path  .. ";.\\LuaSocket\\?.lua"
package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"

local socket = require("socket")
local JSON   = loadfile([[Scripts\JSON.lua]])()

local udpSocket   = nil
local BRIDGE_HOST = "127.0.0.1"
local BRIDGE_PORT = 12800          -- Bridge listens on this port
local SEND_HZ     = 10
local frameCount  = 0
local frameSkip   = 6              -- At ~60fps: send every 6th frame = ~10Hz

function LuaExportStart()
  if UpstreamLuaExportStart then pcall(UpstreamLuaExportStart) end
  udpSocket = socket.udp()
  udpSocket:settimeout(0)
end

function LuaExportAfterNextFrame()
  if UpstreamLuaExportAfterNextFrame then pcall(UpstreamLuaExportAfterNextFrame) end

  frameCount = frameCount + 1
  if frameCount < frameSkip then return end
  frameCount = 0

  local selfData = LoGetSelfData()
  if not selfData then return end  -- Not in a flyable aircraft

  local ias  = LoGetIndicatedAirSpeed()
  local alt  = LoGetAltitudeAboveSeaLevel()
  local hdg  = LoGetMagneticYaw()

  local payload = {
    ts      = socket.gettime(),
    ias_ms  = ias,
    alt_m   = alt,
    hdg_rad = hdg,
    lat     = selfData.LatLongAlt and selfData.LatLongAlt.Lat,
    lon     = selfData.LatLongAlt and selfData.LatLongAlt.Long,
    acft    = selfData.Name,
  }

  local ok, msg = pcall(function()
    udpSocket:sendto(JSON:encode(payload), BRIDGE_HOST, BRIDGE_PORT)
  end)
end

function LuaExportStop()
  if UpstreamLuaExportStop then pcall(UpstreamLuaExportStop) end
  if udpSocket then udpSocket:close() end
end
```

**Why UDP over TCP:**
- No connection state to maintain — DCS can crash/restart without leaving the bridge hanging
- Zero latency overhead for fire-and-forget telemetry
- 10 Hz at ~200 bytes/packet is trivially within UDP capabilities
- If a packet is lost, the next one arrives 100ms later — no retransmit needed

---

## Layer 2: Local Bridge (Node.js on Windows PC)

### Runtime

**Node.js 22.x (Maintenance LTS)** — Confirmed Active LTS as of Feb 2026 is v24, but v22 remains widely supported until April 2027 and supabase-js >= 2.79.0 requires Node 20+. Use v22 for stability unless your dev environment is already on v24.

**Why not Python:** The project decision is Node.js for ecosystem alignment with the web app. Same language, same JSON parsing, easier monorepo tooling.

### UDP Receiver — node:dgram

Built into Node.js. No additional dependency.

```typescript
import dgram from "node:dgram";

const BRIDGE_PORT = 12800;

const server = dgram.createSocket("udp4");

server.on("message", (buf: Buffer, rinfo: dgram.RemoteInfo) => {
  try {
    const packet = JSON.parse(buf.toString("utf8")) as TelemetryPacket;
    // Forward to Supabase Realtime
    publishTelemetry(packet);
  } catch (err) {
    // Malformed packet — silently drop, log count
    console.warn("Bad UDP packet dropped");
  }
});

server.on("error", (err) => {
  console.error("UDP error:", err);
  server.close();
});

server.bind(BRIDGE_PORT, "127.0.0.1", () => {
  console.log(`Bridge listening on UDP 127.0.0.1:${BRIDGE_PORT}`);
});
```

**Key patterns:**
- `buf.toString("utf8")` — convert Buffer to string before JSON.parse
- Wrap JSON.parse in try/catch — DCS can send partial packets if buffer is flushed mid-write
- Only bind to `127.0.0.1` — telemetry is localhost-only; never expose UDP to network
- Use a simple counter to log packet rate without spamming; check every 5 seconds

### Publishing to Supabase Realtime

**Pattern: REST API broadcast (HTTP POST), not WebSocket subscription.**

For a server process that only publishes (never receives), the REST API is the right choice:
- No persistent WebSocket connection to manage
- Stateless — works correctly after bridge restart
- No reconnection logic needed (WebSocket auth is the complex part)
- Simpler code, less failure surface

Node.js 22 has native `fetch` built-in (no node-fetch needed):

```typescript
const SUPABASE_URL     = process.env.SUPABASE_URL!;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY!;
const CHANNEL_TOPIC    = `session:${sessionId}`;

async function publishTelemetry(packet: TelemetryPacket): Promise<void> {
  await fetch(`${SUPABASE_URL}/realtime/v1/api/broadcast`, {
    method: "POST",
    headers: {
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      messages: [{
        topic:   CHANNEL_TOPIC,
        event:   "telemetry",
        payload: packet,
      }],
    }),
  });
}
```

**Rate limiting:** Supabase enforces 10 messages/second per client-side rate limit on the WebSocket path. The REST API limit is not explicitly documented but at 10 Hz you are well within safe territory. **Do not send every UDP frame if DCS is at 60 fps — throttle to 10 Hz in Export.lua as shown above.**

**Alternative: WebSocket subscription from bridge.** If you need the bridge to also receive commands from the cloud (e.g., Phase 3 injection), switch to a persistent WebSocket connection via `createClient` + `.channel().subscribe()`. For Phase 1 (publish-only), REST is simpler and more reliable.

### Throttling and Buffering

At 10 Hz with ~200-byte payloads, the bridge publishes ~2,000 bytes/sec. This is trivial. But apply a rate limiter to protect against Export.lua sending faster than expected:

```typescript
let lastPublish = 0;
const MIN_INTERVAL_MS = 90; // Allow 10Hz with slight tolerance

function maybePublish(packet: TelemetryPacket): void {
  const now = Date.now();
  if (now - lastPublish < MIN_INTERVAL_MS) return;
  lastPublish = now;
  publishTelemetry(packet).catch(console.error);
}
```

### Dependencies — Bridge

```json
{
  "dependencies": {
    "@supabase/supabase-js": "^2.97.0"
  },
  "devDependencies": {
    "typescript": "^5.0.0",
    "@types/node": "^22.0.0",
    "tsx": "^4.0.0"
  }
}
```

**Why tsx over ts-node:** tsx uses esbuild for fast TypeScript transpilation without needing tsconfig setup for every run. Good for the bridge development loop on Windows.

**Why not Bun/Deno:** Node.js is the project decision. Bun is still maturing on Windows. Deno has a different module system. Use Node.js v22+.

---

## Layer 3: Supabase Realtime

### Channel Type Selection

| Type | Use Case | Phase 1? |
|------|----------|----------|
| **Broadcast** | Low-latency ephemeral messages, client-to-client | YES — telemetry |
| **Presence** | Track who is online, sync shared state | Maybe — session pairing status |
| **Postgres Changes** | Listen to database row INSERT/UPDATE/DELETE | No — telemetry is too high-frequency for DB writes |

**Use Broadcast for all telemetry.** Do not write each telemetry packet to Postgres. At 10 Hz for a 20-minute session, that is 12,000 rows. Instead:
- Broadcast telemetry ephemerally
- Write session start/end events and scoring events to Postgres
- Broadcast message size limit: 256 KB on free tier (your ~200-byte packet is far under this)

### Free Tier Limits (Verified from Supabase docs, Feb 2026)

| Limit | Free Tier | Your Usage at 10Hz/20min |
|-------|-----------|--------------------------|
| Messages per billing period | 2,000,000 | 12,000 per session (trivial) |
| Concurrent connections | 200 | ~2 (bridge + dashboard) |
| Messages per second | 100 | 10 (well within) |
| Broadcast payload size | 256 KB | ~0.2 KB (trivial) |
| Channels per connection | 100 | 1 per session |

**Conclusion:** Free tier is more than sufficient for Phase 1.

### Supabase Client Versions

- **@supabase/supabase-js**: `2.97.0` (stable, released Feb 18, 2026). Node.js 20+ required (from v2.79.0 onward).
- **@supabase/realtime-js**: `2.89.x` (bundled inside supabase-js, no separate install needed)

### Channel Naming Convention

Use scoped channel names to prevent cross-session pollution:

```
session:{sessionId}
```

Where `sessionId` is a UUID generated when the user starts a session on the dashboard. The bridge authenticates with a pairing code that resolves to this `sessionId`.

### Authorization Strategy (Phase 1)

For Phase 1 prototype, use the `anon` key with public channels (no RLS on realtime.messages). Add authorization RLS in a later phase when security tightens.

For the bridge REST API calls, use the `anon` key. The REST broadcast endpoint accepts the anon key via `apikey` header.

**Phase 1 auth posture:** Public broadcast channel, protected by obscurity of session ID UUID. Acceptable for prototype. Phase 2 should add:
- `private: true` channel config on dashboard
- RLS policy matching `realtime.topic()` to user's session in Postgres

---

## Layer 4: Next.js Web Dashboard

### Framework

**Next.js 15.x** (stable, October 2024). Next.js 16 was released October 2025 but 15.x remains widely used and stable. For a new project in February 2026:
- **Recommended: Start with Next.js 15.x** (stable, well-documented, no migration friction)
- **Alternative: Next.js 16** if you want Turbopack production stability by default

Use the App Router (not Pages Router). All new Next.js projects should use App Router.

### Supabase Client in Next.js App Router

Realtime subscriptions must run in Client Components (browser-side). Server Components cannot hold WebSocket connections.

```typescript
// lib/supabase/client.ts
import { createClient } from "@supabase/supabase-js";

export const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
);
```

**Important:** Do NOT use `@supabase/ssr` for the Realtime client. `@supabase/ssr` adds server-side cookie handling — not needed for a browser-only Realtime subscription. Use the plain `createClient` from `@supabase/supabase-js`.

### Realtime Subscription Pattern in Client Component

```typescript
"use client";

import { useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import type { RealtimeChannel } from "@supabase/supabase-js";

interface TelemetryPacket {
  ts: number;
  ias_ms: number;
  alt_m: number;
  hdg_rad: number;
  lat?: number;
  lon?: number;
  acft?: string;
}

export function useTelemetry(sessionId: string) {
  const [telemetry, setTelemetry] = useState<TelemetryPacket | null>(null);
  const [status, setStatus] = useState<"connecting" | "connected" | "offline">("connecting");
  const channelRef = useRef<RealtimeChannel | null>(null);

  useEffect(() => {
    if (!sessionId) return;

    const channel = supabase
      .channel(`session:${sessionId}`)
      .on(
        "broadcast",
        { event: "telemetry" },
        (payload: { payload: TelemetryPacket }) => {
          setTelemetry(payload.payload);
          setStatus("connected");
        }
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setStatus("connected");
        if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") setStatus("offline");
        if (status === "CLOSED") setStatus("offline");
      });

    channelRef.current = channel;

    return () => {
      supabase.removeChannel(channel);
    };
  }, [sessionId]);

  return { telemetry, status };
}
```

**Critical cleanup pattern:** Always `supabase.removeChannel(channel)` in the useEffect cleanup. Leaving channels open leaks WebSocket connections. Supabase auto-disconnects after 30 seconds of inactivity, but explicit cleanup is required for correctness on React StrictMode double-mount in development.

### Authentication — NextAuth.js v5

**Package:** `next-auth@beta` (v5.0.0-beta.30 as of Feb 2026)

Auth.js v5 (formerly NextAuth.js) remains in beta but is production-stable and is the recommended path for new Next.js 15+ App Router projects. The stable v4.24.13 does not have first-class App Router support.

```typescript
// auth.ts (root of project)
import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID,
      clientSecret: process.env.AUTH_GOOGLE_SECRET,
    }),
  ],
});
```

```typescript
// app/api/auth/[...nextauth]/route.ts
import { handlers } from "@/auth";
export const { GET, POST } = handlers;
```

**Environment variable changes in v5:** Prefix changed from `NEXTAUTH_` to `AUTH_`. Use:
- `AUTH_SECRET` (replaces `NEXTAUTH_SECRET`)
- `AUTH_GOOGLE_ID`
- `AUTH_GOOGLE_SECRET`
- `AUTH_URL` (replaces `NEXTAUTH_URL`)

**Why Auth.js v5 over Supabase Auth:**
- Not locked to Supabase for authentication
- Native Next.js App Router integration
- Simpler Google OAuth configuration
- No Supabase Auth user table to manage
- Project decision already made

### UI — shadcn/ui + Tailwind CSS v4

**Tailwind CSS v4** (released January 22, 2025, stable). Key changes from v3:
- CSS-first configuration (no `tailwind.config.js` needed)
- Uses `@tailwindcss/postcss` plugin
- 5x faster full builds, 100x faster incremental builds
- `@import "tailwindcss"` replaces `@tailwind base; @tailwind components; @tailwind utilities;`

**shadcn/ui** fully supports Tailwind v4 and React 19 (as of March 2025 updates). Use the CLI:

```bash
npx shadcn@latest init
```

Select Tailwind v4 when prompted. Components to install for Phase 1:
- `card` — telemetry display panels
- `badge` — connection status indicator
- `separator` — panel dividers
- `skeleton` — loading states before first telemetry packet

**Why shadcn/ui over Chakra/MUI/Radix raw:**
- Copy-paste components, not black-box dependencies
- Full control over styling — essential for JARVIS dark theme customization
- Works with Tailwind v4 out of the box
- No runtime CSS-in-JS overhead

---

## Layer 5: Infrastructure

### Vercel (Hosting)

Hobby plan works for Phase 1. Constraints to know:
- **Serverless function timeout:** 10s on Hobby (Pro: 300s). Not relevant for dashboard (no long-running server functions needed).
- **Edge middleware:** Available on Hobby. Use for NextAuth session checks.
- **Environment variables:** Set `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `AUTH_*` in Vercel project settings.

### Supabase (Database + Realtime)

Free tier project. Constraints:
- Project pauses after 1 week of inactivity (on free tier). Send a keepalive ping or upgrade to Pro for persistent uptime.
- 500MB database storage (more than enough for Phase 1 sessions table)
- Database schema needed: `sessions` table (id, user_id, created_at, ended_at, pairing_code)

### Monorepo Structure

```
DCS JARVIS/
  apps/
    web/          # Next.js app (Vercel)
    bridge/       # Node.js bridge (runs on gamer PC)
  packages/
    types/        # Shared TypeScript types (TelemetryPacket, etc.)
  .planning/
  package.json    # Workspace root (npm workspaces or pnpm)
```

**Why monorepo:** Share `TelemetryPacket` TypeScript type between bridge and web app without publishing a package. Single repo means a single PR can update both sides of the protocol simultaneously.

---

## Alternatives Considered

### Realtime Provider

| Option | Why Not |
|--------|---------|
| **Pusher** | Paid at any meaningful scale; no free tier for server-side publishing |
| **Ably** | Good product but adds a vendor dependency; Supabase bundles Realtime with storage |
| **Socket.io self-hosted** | Requires a persistent server; Vercel is serverless |
| **AWS IoT Core** | Overkill; complex setup; costs money |
| **Supabase Postgres Changes** | Wrong tool: too slow for 10 Hz telemetry; every message hits the DB |

### Bridge Runtime

| Option | Why Not |
|--------|---------|
| **Python** | Different ecosystem from web app; project decision already made |
| **Rust** | Overkill for prototype; no team familiarity assumed |
| **Bun** | Still maturing on Windows; unknown production stability |
| **Electron** | Heavy; unnecessary for a CLI bridge process |

### Auth Provider

| Option | Why Not |
|--------|---------|
| **Supabase Auth** | Ties auth to Supabase; adds JWT complexity with Realtime RLS |
| **Clerk** | Paid after free tier; external dependency |
| **NextAuth v4 stable** | No native App Router support; legacy patterns |

### CSS Framework

| Option | Why Not |
|--------|---------|
| **CSS Modules** | Too verbose for rapid prototype UI iteration |
| **Styled Components** | Runtime CSS-in-JS; performance overhead; no Tailwind v4 compatibility |
| **MUI** | Heavy; opinionated design system fights JARVIS dark theme |
| **Tailwind v3** | Still works but v4 is stable and faster; new projects should use v4 |

---

## Installation

### Bridge (apps/bridge)

```bash
npm init -y
npm install @supabase/supabase-js
npm install -D typescript @types/node tsx
```

```bash
# Run during development
npx tsx src/index.ts
```

### Web App (apps/web)

```bash
npx create-next-app@latest web --typescript --tailwind --app --src-dir
cd web
npm install @supabase/supabase-js next-auth@beta
npx shadcn@latest init
npx shadcn@latest add card badge separator skeleton
```

---

## Environment Variables

### Bridge (.env)

```
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
UDP_PORT=12800
```

### Web App (.env.local)

```
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
AUTH_SECRET=your-auth-secret-min-32-chars
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
AUTH_URL=http://localhost:3000
```

---

## DCS-Specific Pitfalls (Stack Level)

**Export.lua chaining is mandatory.** DCS only loads one Export.lua. If other tools (TACVIEW, SRS, Helios) are installed, they each add their own Export.lua. The community convention is to chain them with upstream calls:

```lua
local upstreamStart = LuaExportStart
function LuaExportStart()
  if upstreamStart then pcall(upstreamStart) end
  -- your init here
end
```

Always check for upstream functions before overriding; failure to chain breaks other DCS tools.

**`LoGetSelfData()` returns nil in spectator mode.** Guard every call:

```lua
local selfData = LoGetSelfData()
if not selfData then return end
```

**LuaSocket path must be set before `require("socket")`.** The path assignment must happen at the top of `LuaExportStart`, not module-level, because DCS resets the environment between missions.

**UDP port 12800 may conflict.** DCS uses 12800 and 12801 for its own internal communications. Use a different port: `12810` or `42069` are commonly used by community scripts.

---

## Confidence Assessment

| Area | Confidence | Basis |
|------|------------|-------|
| Supabase Realtime API | HIGH | Verified via official Supabase docs (Feb 2026), pricing page, limits page |
| Node.js dgram UDP | HIGH | Official Node.js docs v25.7.0 |
| Next.js App Router | HIGH | Official Next.js releases, Vercel templates |
| shadcn/ui + Tailwind v4 | HIGH | Official shadcn docs, changelog (March 2025) |
| NextAuth.js v5 | MEDIUM | Beta status; latest beta 5.0.0-beta.30; not stable release |
| DCS Export.lua callbacks | HIGH | Hoggit wiki, multiple community repos confirming same pattern |
| DCS JSON.lua availability | MEDIUM | Widely reported by community (jboecker/dcs-export-core, jboecker/dcs-witchcraft) but not in official ED documentation |
| LoGet* function units | HIGH | Hoggit wiki DCS_Export_Script, community verification |
| Node 22 LTS status | HIGH | Official nodejs.org releases page (Node 24 is Active LTS, Node 22 is Maintenance LTS as of Feb 2026) |
| Supabase free tier limits | HIGH | Verified from supabase.com/docs/guides/realtime/pricing and limits pages |

---

## Sources

- [Supabase Realtime Broadcast](https://supabase.com/docs/guides/realtime/broadcast)
- [Supabase Realtime Limits](https://supabase.com/docs/guides/realtime/limits)
- [Supabase Realtime Pricing](https://supabase.com/docs/guides/realtime/pricing)
- [Supabase Realtime Authorization](https://supabase.com/docs/guides/realtime/authorization)
- [Supabase JS Releases](https://github.com/supabase/supabase-js/releases)
- [Auth.js Migrating to v5](https://authjs.dev/getting-started/migrating-to-v5)
- [Node.js Releases](https://nodejs.org/en/about/previous-releases)
- [Node.js dgram Documentation](https://nodejs.org/api/dgram.html)
- [DCS Export Script — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_Export_Script)
- [DCS Export — Hoggit Wiki](https://wiki.hoggitworld.com/view/DCS_export)
- [DCS net.lua2json](https://wiki.hoggitworld.com/view/DCS_func_lua2json)
- [jboecker/dcs-witchcraft Export.lua pattern](https://github.com/jboecker/dcs-witchcraft/blob/master/WitchcraftExport.lua)
- [jboecker/dcs-export-core Protocol.lua](https://github.com/jboecker/dcs-export-core/blob/master/DcsExportCore/Protocol.lua)
- [aronCiucu/DCSTheWay — Export pattern](https://github.com/aronCiucu/DCSTheWay/blob/main/dcsFiles/TheWay.lua)
- [Tailwind CSS v4 Release](https://tailwindcss.com/blog/tailwindcss-v4)
- [shadcn/ui Tailwind v4](https://ui.shadcn.com/docs/tailwind-v4)
- [Next.js 15 Release](https://nextjs.org/blog/next-15)
- [Next.js 16 Release](https://nextjs.org/blog/next-16)
