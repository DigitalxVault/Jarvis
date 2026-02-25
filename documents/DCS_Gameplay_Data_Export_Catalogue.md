# DCS Gameplay Data Export Catalogue (Lua)

This document lists what data can be extracted from **DCS World during gameplay** using Lua, and what each data point means—so you can design a **JARVIS-style bridge** (DCS → local service → web dashboard).

---

## 1) Where data comes from in DCS (Lua “surfaces”)

### A. Export Environment (Export.lua) — best for telemetry streaming
**Use case:** High-rate flight telemetry and (optionally) some sensor/target/world data.  
**Typical pipeline:** `Saved Games/DCS*/Scripts/Export.lua` → UDP/TCP/file → local service → browser UI.

**Strengths**
- Designed for continuous export loops (per-frame / throttled).
- Commonly used by tools like Tacview / SRS / motion platforms.
- Best place to do socket I/O without changing mission sandbox settings (depends on your setup).

**Constraints**
- Some exports can be restricted in multiplayer (server policy).
- Some functions/fields may vary by module.

### B. Mission Environment (Mission scripting + Triggers)
**Use case:** “Semantics” and training logic — trigger zones, scoring, events (takeoff/land/kill).  
**Typical pipeline:** mission script sets flags/state → Export.lua reads flags and exports snapshots.

**Strengths**
- Ideal for time-in-tolerance scoring, gate checks, scripted progression.
- Has direct access to triggers, zones, flags, event handlers.

**Constraints**
- Mission scripting is sanitized by default (external file/network access may be blocked unless changed).
- It’s best to keep mission side focused on “what happened” and do external I/O in Export.lua or a Hook.

### C. GUI/Hooks (Saved Games/DCS*/Scripts/Hooks)
**Use case:** Persistent callbacks for server/admin or GUI-side automation (advanced).  
Often used in dedicated server setups or automation tools.

---

## 2) Export.lua telemetry (high-value data points)

Below is a practical catalogue you can export and visualize.

> **Note on units:** DCS export APIs commonly return **SI units** (m/s, meters, radians). Convert for pilots/UI:
> - m/s → knots: `knots = mps * 1.943844`
> - meters → feet: `ft = m * 3.28084`
> - radians → degrees: `deg = rad * 57.2958`

---

### 2.1 Time & session metadata
| Data point | What it represents | Why it’s useful in a dashboard |
|---|---|---|
| Model time (simulation seconds) | Internal sim clock since mission start | Syncs graphs; stable timestamps for telemetry frames |
| Mission start time | Reference anchor for the mission | Session alignment and report headers |
| Player/unit identity | Unit name / type | Labels in logs; multi-sortie analytics |

---

### 2.2 Ownship position & orientation (core flight telemetry)
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Latitude / Longitude / Altitude (MSL) | Aircraft geodetic position | Map view, corridor compliance, gate detection cross-check |
| Pitch / Bank / Yaw | Aircraft attitude | Stability scoring, roll discipline, turn quality |
| Vertical velocity | Climb/descent rate | Detect “settling”, altitude capture quality |
| Vector velocity (x,y,z) | 3D velocity in world axes | Accurate motion analysis and derived metrics |
| Angular velocity (x,y,z) | Rotational rates | “Smoothness” scoring, aggressive control detection |
| AoA (Angle of Attack) | Wing loading angle (rad) | Over-G / stall margin coaching, approach analysis |
| Acceleration units (G) | G-load components | Overstress detection, maneuver profiling |

---

### 2.3 Air data & performance
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Indicated Airspeed (IAS) | Speed “seen” by pitot system | Speed band scoring (±10–15 kt) |
| True Airspeed (TAS) | True speed through airmass | Energy management, performance comparisons |
| Mach number | Speed relative to sound | High-altitude phase analysis |
| Altitude AGL (if available) | Height above ground | Low-level profile gating and safety checks |

---

### 2.4 Engine & fuel
| Data point | What it represents | Why it’s useful |
|---|---|---|
| RPM (per engine) | Engine RPM percent | Power management coaching |
| Temperatures | Engine temperature metrics | Overtemp events, health monitoring |
| Fuel internal mass (kg) | Internal fuel amount | Bingo planning, endurance coaching |
| Fuel external mass (kg) | External fuel amount | Drop-tank behavior, mission configuration checks |
| Fuel consumption (kg/s) | Current flow | Trend analysis, “throttle discipline” |

---

### 2.5 Mechanization (gear/flaps/speedbrake/canopy/etc.)
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Gear position | Landing gear status/value | Landing checklist validation |
| Flaps position | Flap setting/value | Approach configuration checks |
| Speedbrake position | Speedbrake status/value | Energy control coaching |
| Canopy / hook / refuel boom (module-dependent) | Aircraft-specific mechanisms | Checklist automation and safety warnings |

---

### 2.6 Payload / weapons / countermeasures
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Stations + weapon counts | Current stores and counts | After-action review and training constraints |
| Cannon shells | Remaining gun ammo | Range discipline metrics |
| Chaff / flares counts | Countermeasure remaining | Threat response coaching and debrief |

---

### 2.7 Navigation / route (if used)
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Route / waypoints | Planned path/sequence | Gate sequence compliance, ETAs |
| Current waypoint index/name (derived) | Where the pilot is in the route | “Next gate” guidance and scoring context |

> Many dashboards compute bearing/range to next waypoint from ownship lat/lon and waypoint lat/lon.

---

### 2.8 Sensors / targets (often restricted in MP; module-dependent)
These can be powerful for “JARVIS coaching”, but plan to **degrade gracefully** when unavailable.

| Data point | What it represents | Why it’s useful |
|---|---|---|
| Locked target info | Details of a locked target (range, closure, etc.) | BVR coaching, target awareness |
| Target/track lists (e.g., TWS) | Tracks detected by radar/sensors | Situational awareness analytics |
| Sighting system state | Radar/EO/laser/ECM states | “Radar discipline” or training constraints |

---

### 2.9 World objects (heavy; often restricted in MP)
| Data point | What it represents | Why it’s useful |
|---|---|---|
| World object list | All active objects + metadata | Tacview-like replay, proximity checks |

**Performance note:** Polling world objects frequently can be expensive. Prefer event-driven + ownship telemetry unless you truly need global tracks.

---

### 2.10 Cockpit arguments & indicator strings (advanced; per-aircraft mapping)
| Data point | What it represents | Why it’s useful |
|---|---|---|
| Draw argument values | Per-aircraft “argument numbers” for cockpit/airframe state | Custom cockpit lights/states for checklists |
| Indicator strings | Rendered text on cockpit indicators (varies) | Radio panels, warning pages, CMS feedback |

**Important:** Argument numbers and indicator IDs are **not standardized** across modules, so this becomes a per-aircraft integration task (mapping table per module).

---

## 3) Mission scripting data (events, zones, scoring)

Mission scripting is ideal for **training semantics** and “snapshot triggers”.

### 3.1 Trigger zones (“gates”)
You can define trigger zones in Mission Editor and then track:
- **Entered Zone X at time T**
- **Time spent in zone**
- **Within-tolerance while inside zone** (altitude/speed/heading bands)
- **Gate pass/fail** (score threshold)

These become dashboard events:
- `enter_zone`, `exit_zone`, `gate_passed`, `gate_failed`

### 3.2 Simulator events (world event handler)
Using an event handler you can capture:
- **Takeoff**
- **Landing**
- **Shot fired / weapon release**
- **Hit / damage**
- **Unit dead / destroyed**
- **Player enters/leaves unit** (varies)

These become dashboard events:
- `takeoff`, `landing`, `weapon_release`, `hit`, `kill`, `crash`

### 3.3 Mission flags / custom state (best for Export.lua integration)
Use flags (or mission globals) to record:
- Current level / stage
- Score
- Gate index
- Chopper destroyed count
- Penalties / warnings
- “Run started” / “Run ended” state

Export.lua can poll these flags and include them in outbound telemetry.

---

## 4) Multiplayer/export availability (planning note)

In multiplayer, servers may restrict export categories (commonly described as):
- **Ownship export** (your aircraft)
- **Sensor export** (contacts/locks)
- **Object export** (world object list)

For a robust JARVIS project:
- Build core features using **ownship + mission flags** only.
- Treat sensors/world objects as optional “enhancements”.

---

## 5) Recommended dashboard schema (minimum viable)

If you want to plan your database/events up-front, this schema works well:

### 5.1 Telemetry message (streamed 10–30 Hz)
```json
{
  "type": "telemetry",
  "t_model": 1234.56,
  "pos": { "lat": 1.234, "lon": 103.456, "alt_m": 2500.0 },
  "att": { "pitch_rad": 0.01, "bank_rad": -0.12, "yaw_rad": 1.5 },
  "spd": { "ias_mps": 140.0, "tas_mps": 150.0, "vvi_mps": 2.0, "mach": 0.45 },
  "aero": { "aoa_rad": 0.08, "g": { "x": 0.0, "y": 1.1, "z": 0.0 } },
  "fuel": { "internal_kg": 1200.0, "external_kg": 0.0, "flow_kgps": 0.35 },
  "mech": { "gear": 0.0, "flaps": 0.2, "speedbrake": 0.0 },
  "mission": { "score": 120, "stage": 2, "gate": "WP03" }
}
```

### 5.2 Event message (triggered)
```json
{
  "type": "event",
  "t_model": 1240.10,
  "event": "enter_zone",
  "zone": "GATE_B",
  "mission": { "stage": 2, "score": 140 }
}
```

---

## 6) Practical advice for “trigger zone → snapshot export”

A proven approach:
1. **Mission script** detects: enter/exit zone, pass/fail, kill, etc.
2. It writes **flags/state** (score, gateId, eventType).
3. **Export.lua** reads flags and emits a single **snapshot event packet** to your local service.
4. Local service updates the browser UI (WebSocket) and stores to disk (SQLite/Postgres).

This keeps mission scripts clean and avoids depending on mission-side network/file permissions.

---

## Appendix: Example “data buckets” for training profiles

### Level 1 (stability bands)
- Time-in-altitude band
- Time-in-heading band
- Time-in-speed band
- Recovery time back into band after deviation
- Over-G events

### Level 2 (gates + controlled maneuvers)
- Gate completion times (A→B→C)
- Average bank angle during turns
- Altitude deviation while turning
- Speed control during maneuvers

### Level 3 (precision sprint)
- Total time
- Gate penalties
- Precision scoring (tight band time)
- “Stability regain” checkpoints (out-of-band duration)

---

If you want, provide your exact training mission rules (bands, gates, scoring weights), and I can generate a **final JSON schema** + a **recommended dashboard layout** (cards + charts) that maps 1:1 to these exportable data points.
