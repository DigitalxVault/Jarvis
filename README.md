<p align="center">
  <img src="https://img.shields.io/badge/J·A·R·V·I·S-DCS%20Telemetry-00d4ff?style=for-the-badge&labelColor=010a1a" alt="JARVIS DCS" />
</p>

<h1 align="center">J · A · R · V · I · S</h1>

<p align="center">
  <strong>Real-time DCS World telemetry on a tactical web dashboard</strong>
</p>

<p align="center">
  <a href="#architecture"><img src="https://img.shields.io/badge/Architecture-UDP→Cloud→Web-00d4ff?style=flat-square&logo=data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyNCIgaGVpZ2h0PSIyNCIgdmlld0JveD0iMCAwIDI0IDI0IiBmaWxsPSJub25lIiBzdHJva2U9IiMwMGQ0ZmYiIHN0cm9rZS13aWR0aD0iMiI+PHBhdGggZD0iTTIyIDEyaC00bC0zIDlMOSAzLTYgOUgyIi8+PC9zdmc+" alt="Architecture" /></a>
  <img src="https://img.shields.io/badge/Status-v1.0%20MVP-00ff88?style=flat-square" alt="Status" />
  <img src="https://img.shields.io/badge/License-Private-666?style=flat-square" alt="License" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=nextdotjs&logoColor=white" alt="Next.js" />
  <img src="https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React" />
  <img src="https://img.shields.io/badge/Supabase-Realtime-3FCF8E?style=flat-square&logo=supabase&logoColor=white" alt="Supabase" />
  <img src="https://img.shields.io/badge/Tailwind_CSS-v4-06B6D4?style=flat-square&logo=tailwindcss&logoColor=white" alt="Tailwind" />
  <img src="https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript" />
  <img src="https://img.shields.io/badge/Node.js-≥22-339933?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js" />
  <img src="https://img.shields.io/badge/Lua-DCS%20Export-2C2D72?style=flat-square&logo=lua&logoColor=white" alt="Lua" />
  <img src="https://img.shields.io/badge/pnpm-Workspaces-F69220?style=flat-square&logo=pnpm&logoColor=white" alt="pnpm" />
</p>

---

## Overview

JARVIS streams live flight telemetry from [DCS World](https://www.digitalcombatsimulator.com/) through a local Node.js bridge, over the internet via Supabase Realtime, and onto a JARVIS-themed web dashboard — all in under 500ms.

```
 ┌──────────────┐    UDP 10 Hz    ┌──────────────┐    REST 2-5 Hz    ┌──────────────┐
 │  DCS World   │ ──────────────→ │   Bridge     │ ───────────────→  │   Supabase   │
 │  Export.lua  │    localhost     │   Node.js    │                   │   Realtime   │
 └──────────────┘                 └──────────────┘                   └──────┬───────┘
                                                                           │
                                                                    WebSocket
                                                                           │
                                                                    ┌──────▼───────┐
                                                                    │  Web Dashboard│
                                                                    │  Next.js 16   │
                                                                    └──────────────┘
```

**Target aircraft:** F-16C Viper (Block 50) — works with any DCS module via `LoGetSelfData()`

---

## ✨ Features

| Feature | Description |
|---------|-------------|
| 📡 **Live Telemetry** | IAS (knots), ALT (feet), HDG (degrees) updating at 4-5 Hz |
| 🔗 **Session Pairing** | 6-character code with 5-min TTL — bridge claims scoped channel access |
| 🛡️ **Resilience** | Exponential backoff, fetch timeout, DCS silence detection, tab re-subscribe |
| 🎨 **JARVIS HUD Theme** | Scanline overlay, cyan glow, monospace typography, dark tactical aesthetic |
| 🔐 **Google OAuth** | NextAuth v5 with persistent sessions |
| 🐛 **Debug Panel** | Packets/sec, last packet time, subscription status, raw packet viewer |
| 📊 **Connection Status** | 4-state indicator: Connected / DCS Offline / Reconnecting / Offline |
| ⚡ **Memory Safe** | Heap instrumentation, no growth over 20-minute sessions |

---

## 📁 Project Structure

```
jarvis-dcs/
├── apps/
│   └── web/                    # Next.js 16 dashboard
│       ├── src/
│       │   ├── app/            # App Router pages + API routes
│       │   ├── components/     # Dashboard, TelemetryCard, ConnectionStatus, DebugPanel
│       │   ├── hooks/          # useTelemetry (Supabase subscription + visibility)
│       │   └── lib/            # Supabase client
│       └── ...
├── packages/
│   ├── bridge/                 # Node.js UDP → Supabase relay
│   │   └── src/
│   │       ├── index.ts        # Entry point
│   │       ├── udp.ts          # UDP receiver (port 7779)
│   │       ├── publisher.ts    # Supabase publisher + backoff
│   │       ├── queue.ts        # Bounded publish queue
│   │       └── metrics.ts      # Memory + telemetry metrics
│   └── shared/                 # Shared TypeScript types
│       └── src/
│           ├── types.ts        # TelemetryPacket, HeartbeatPacket, Session
│           ├── channels.ts     # Channel naming helpers
│           └── constants.ts    # Shared constants
├── dcs/
│   ├── jarvis_export.lua       # DCS Export.lua (10 Hz, pcall, dofile chain)
│   └── install.bat             # Auto-installer for DCS Scripts folder
├── supabase/
│   └── migrations/
│       └── 001_sessions.sql    # Sessions table schema
├── pnpm-workspace.yaml
├── tsconfig.base.json
└── .env.example
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** >= 22
- **pnpm** >= 9
- **DCS World** (any edition) installed on Windows
- **Supabase** project with Realtime enabled
- **Google OAuth** credentials (for NextAuth)

### 1. Clone and install

```bash
git clone https://github.com/your-org/jarvis-dcs.git
cd jarvis-dcs
pnpm install
```

### 2. Configure environment

Copy the example env file and fill in your credentials:

```bash
cp .env.example .env.local
```

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# NextAuth.js v5
AUTH_SECRET=your-auth-secret-min-32-chars
AUTH_GOOGLE_ID=your-google-client-id
AUTH_GOOGLE_SECRET=your-google-client-secret
```

Create the bridge env file:

```bash
cp .env.local packages/bridge/.env
```

### 3. Set up Supabase

Run the migration against your Supabase project:

```sql
-- Execute supabase/migrations/001_sessions.sql in Supabase SQL editor
```

Enable Realtime on the `sessions` table in the Supabase dashboard.

### 4. Install DCS exporter

**Option A — Automatic (Windows):**

```cmd
cd dcs
install.bat
```

**Option B — Manual:**

1. Copy `dcs/jarvis_export.lua` to `%USERPROFILE%\Saved Games\DCS\Scripts\`
2. Add to `Export.lua`:
   ```lua
   dofile(lfs.writedir()..'Scripts/jarvis_export.lua')
   ```

> 📌 Compatible with TacView, SRS, and Helios via `dofile()` chaining.

### 5. Run

In separate terminals:

```bash
# Terminal 1 — Web dashboard
pnpm dev:web

# Terminal 2 — Bridge (on the DCS PC)
pnpm dev:bridge
```

### 6. Connect

1. Open `http://localhost:3000` and sign in with Google
2. Create a new session — note the 6-character pairing code
3. Start the bridge with the pairing code (or use the dev channel)
4. Launch a DCS mission — telemetry appears on the dashboard

---

## 🏗️ Architecture

### Data Flow

```
DCS World (F-16C)
  │
  ├─ LuaExportBeforeNextFrame() @ 10 Hz
  ├─ LoGetSelfData() → IAS, ALT, HDG, position, attitude
  ├─ pcall wrapped (crash-safe)
  ├─ JSON encoded via pure-Lua encoder
  │
  ▼ UDP localhost:7779
  │
Bridge (Node.js)
  │
  ├─ dgram socket receives JSON packets
  ├─ Bounded queue (max 100, drop-oldest)
  ├─ Downsamples 10 Hz → 2-5 Hz
  ├─ Supabase REST broadcast (not WebSocket)
  ├─ Exponential backoff on failure
  ├─ AbortSignal.timeout(5000) on all fetches
  ├─ DCS silence detection (edge-triggered)
  ├─ Memory logging + heap snapshots
  │
  ▼ Supabase Realtime Broadcast
  │
Web Dashboard (Next.js 16)
  │
  ├─ Supabase JS client (worker: true)
  ├─ heartbeatCallback for silent disconnect detection
  ├─ Channel deduplication on re-subscribe
  ├─ Page Visibility API re-subscribe
  ├─ useTelemetry hook → React state
  │
  ▼ JARVIS HUD UI
  │
  ├─ TelemetryCards (IAS / ALT / HDG)
  ├─ ConnectionStatus (4-state indicator)
  ├─ DebugPanel (metrics + raw packets)
  └─ JARVIS theme (scanlines, cyan glow)
```

### Session Pairing

```
Web App                          Bridge
  │                                │
  ├─ POST /api/sessions ──────→   │  (creates session + 6-char code)
  │                                │
  │  ← pairing code displayed     │
  │                                │
  │                                ├─ POST /api/bridge/claim
  │                                │    { code: "ABC123" }
  │                                │
  │                                ├─ ← { channelName, bridgeToken }
  │                                │
  │  subscribes to channel ←──────┤  publishes to scoped channel
  │                                │
  ▼  telemetry flows               ▼
```

---

## 🧪 Testing

The project includes a [Test Plan](JARVIS_DCS_Prototype_Test_Plan.md) with six test cases:

| Test | Description | Status |
|------|-------------|--------|
| D1 | Full pipeline smoke test | ✅ |
| D2 | Rate/throttle verification (10 Hz → 2-5 Hz) | ✅ |
| D3 | Packet loss handling | ✅ |
| D4 | Internet drop + reconnect | ✅ |
| D5 | DCS stop/restart detection | ✅ |
| D6 | Session scope enforcement | ✅ |

### Smoke test

```bash
# Bridge with dev channel
pnpm smoke:bridge

# Web dev server
pnpm smoke:web
```

---

## 🎨 Visual Theme

The dashboard uses a JARVIS-inspired tactical HUD aesthetic:

| Element | Value |
|---------|-------|
| Background | `#010a1a` |
| Panels | `#000d1a` |
| Bars | `#00050f` |
| Primary | `#00d4ff` |
| Accent | `#00ffff` |
| Success | `#00ff88` |
| Danger | `#ff4444` |
| Font | `Courier New` monospace |
| Effects | Scanline overlay, text glow, corner brackets |

---

## 🗺️ Roadmap

### ✅ v1.0 — MVP (Shipped)

End-to-end telemetry pipeline with session pairing, resilience, and JARVIS HUD dashboard.

### 🔮 Future

- **Training Events** — Mission scripting, trigger zones, kill scoring, event feed
- **Coaching Engine** — Rule-based IAS/ALT band checks, configurable thresholds
- **DCS Injection** — `trigger.action.outText`, audio cues, mission flag manipulation
- **JARVIS Voice** — Session start/end cues, gate events, rate-limited warnings
- **Multi-Pilot** — Instructor view, session aggregation, multiplayer support

---

## 📝 Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev:web` | Start Next.js dev server |
| `pnpm dev:bridge` | Start bridge with hot reload |
| `pnpm build` | Build all packages |
| `pnpm typecheck` | Type-check all packages |
| `pnpm smoke:bridge` | Run bridge with dev channel |
| `pnpm smoke:web` | Run web in dev mode |

---

## ⚠️ Known Limitations

- **Google OAuth** credentials are placeholders — configure your own in `.env.local`
- **Supabase RLS** is disabled for the prototype — re-enable for production
- **DCS testing** requires a Windows PC with DCS World installed
- **Supabase free tier** pauses after 1 week of inactivity — unpause manually
- **Desktop only** — no mobile/tablet layout (pilot is at a PC)

---

<p align="center">
  <sub>Built with 🛩️ for DCS World pilots</sub>
</p>
