-- ═══════════════════════════════════════════════════════
-- JARVIS DCS Telemetry Exporter v2.0
-- Chain-compatible with TacView / SRS / Helios via dofile()
-- Place in: Saved Games\DCS\Scripts\Export.lua
-- ═══════════════════════════════════════════════════════

local jarvis_udp = nil
local jarvis_port = 7779
local jarvis_host = "127.0.0.1"
local jarvis_interval = 0.1   -- 10 Hz = every 100ms
local jarvis_last_send = 0
local jarvis_JSON = nil

-- Slow-poll interval for tactical/weapons data (1 Hz)
local jarvis_slow_interval = 1.0
local jarvis_last_slow_send = 0

-- Aircraft-specific normalization constants (F-16C Viper)
local JARVIS_FUEL_INTERNAL_MAX = 3200   -- Internal tanks (kg)
local JARVIS_FUEL_EXTERNAL_MAX = 1400   -- External tank (kg)
local JARVIS_ENGINE_MAX_RPM = 10400     -- F110-GE-129 max RPM

-- Anti-cheat permission cache (checked once per mission)
local jarvis_object_export_ok = false
local jarvis_sensor_export_ok = false

-- ── Chain existing Export.lua functions ──
local _prev_LuaExportStart = LuaExportStart
local _prev_LuaExportAfterNextFrame = LuaExportAfterNextFrame
local _prev_LuaExportStop = LuaExportStop

function LuaExportStart()
  -- Chain upstream first
  if _prev_LuaExportStart then pcall(_prev_LuaExportStart) end

  -- Setup LuaSocket
  package.path  = package.path  .. ";.\\LuaSocket\\?.lua"
  package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"

  local ok_sock, socket = pcall(require, "socket")
  if ok_sock and socket then
    jarvis_udp = socket.udp()
    jarvis_udp:settimeout(0)
  end

  -- Cache JSON encoder (try DCS-bundled JSON.lua)
  local ok_json, json = pcall(loadfile, "Scripts\\JSON.lua")
  if ok_json and json then
    jarvis_JSON = json()
  end

  -- Check anti-cheat permissions (EXPT-07)
  jarvis_object_export_ok = (LoIsObjectExportAllowed and LoIsObjectExportAllowed()) or false
  jarvis_sensor_export_ok = (LoIsSensorExportAllowed and LoIsSensorExportAllowed()) or false
end

function LuaExportAfterNextFrame()
  -- Chain upstream first
  if _prev_LuaExportAfterNextFrame then pcall(_prev_LuaExportAfterNextFrame) end

  -- Guard: no socket or no JSON encoder
  if not jarvis_udp or not jarvis_JSON then return end

  local t = LoGetModelTime()

  -- ── High-frequency flight data (10 Hz) ──
  if t - jarvis_last_send >= jarvis_interval then
    jarvis_last_send = t
    pcall(jarvis_send_flight, t)
  end

  -- ── Low-frequency tactical/weapons data (1 Hz) ──
  if t - jarvis_last_slow_send >= jarvis_slow_interval then
    jarvis_last_slow_send = t
    pcall(jarvis_send_tactical, t)
  end
end

-- ── High-frequency flight telemetry (10 Hz) ──
function jarvis_send_flight(t)
  local self_data = LoGetSelfData()
  if not self_data then return end

  local lla = self_data.LatLongAlt
  if not lla then return end

  -- Acceleration (G-loads) — returns {x, y, z}
  local acc = LoGetAccelerationUnits() or {x=0, y=1, z=0}
  -- Angular velocity — returns {x, y, z} rad/s
  local angvel = (LoGetAngularVelocity and LoGetAngularVelocity()) or {x=0, y=0, z=0}
  -- Engine info — LoGetEngineInfo returns table per engine (EXPT-08 fix)
  local eng_raw = (LoGetEngineInfo and LoGetEngineInfo()) or {}
  -- F-16 is single-engine: try .left (common convention) then [1], then raw table
  local eng1 = eng_raw.left or eng_raw[1] or eng_raw

  local encoded = jarvis_JSON:encode({
    type    = "telemetry",
    t_model = t,
    pos     = {
      lat      = lla.Lat,
      lon      = lla.Long,
      alt_m    = lla.Alt,
      alt_agl_m = (LoGetAltitudeAboveGroundLevel and LoGetAltitudeAboveGroundLevel()) or 0
    },
    att     = {
      pitch_rad = self_data.Pitch,
      bank_rad  = self_data.Bank,
      yaw_rad   = self_data.Heading
    },
    spd     = {
      ias_mps = LoGetIndicatedAirSpeed(),
      tas_mps = (LoGetTrueAirSpeed and LoGetTrueAirSpeed()) or 0,
      vvi_mps = (LoGetVerticalVelocity and LoGetVerticalVelocity()) or 0,
      mach    = (LoGetMachNumber and LoGetMachNumber()) or 0
    },
    hdg_rad = LoGetMagneticYaw(),
    aero    = {
      aoa_rad = (LoGetAngleOfAttack and LoGetAngleOfAttack()) or 0,
      g       = { x = acc.x, y = acc.y, z = acc.z },
      ang_vel = { x = angvel.x, y = angvel.y, z = angvel.z }
    },
    fuel    = {
      internal = math.min(1, ((LoGetFuelData and LoGetFuelData().fuel_internal) or 0) / JARVIS_FUEL_INTERNAL_MAX),
      external = math.min(1, ((LoGetFuelData and LoGetFuelData().fuel_external) or 0) / JARVIS_FUEL_EXTERNAL_MAX)
    },
    eng     = {
      rpm_pct  = math.min(100, ((eng1.RPM or eng1.rpm or 0) / JARVIS_ENGINE_MAX_RPM) * 100),
      fuel_con = eng1.fuel_consumption or eng1.FuelConsumption or 0
    }
  })

  if encoded then
    pcall(function()
      jarvis_udp:sendto(encoded, jarvis_host, jarvis_port)
    end)
  end
end

-- ── Low-frequency tactical data (1 Hz) ──
function jarvis_send_tactical(t)
  local self_data = LoGetSelfData()
  if not self_data then return end

  local packet = {
    type    = "tactical",
    t_model = t,
  }

  -- ── World Objects (EXPT-01) — anti-cheat gated ──
  if jarvis_object_export_ok and LoGetWorldObjects then
    local raw_objects = LoGetWorldObjects("units") or {}
    local objects = {}
    local player_id = (LoGetPlayerPlaneId and LoGetPlayerPlaneId()) or -1

    for id, obj in pairs(raw_objects) do
      -- Skip ownship
      if id ~= player_id and obj.LatLongAlt then
        objects[#objects + 1] = {
          id    = id,
          name  = obj.Name or "",
          type  = obj.Type or {},
          coal  = obj.Coalition or "",
          lat   = obj.LatLongAlt.Lat,
          lon   = obj.LatLongAlt.Long,
          alt   = obj.LatLongAlt.Alt,
          hdg   = obj.Heading or 0,
          flags = {
            radar  = (obj.Flags and obj.Flags.RadarActive) or false,
            human  = (obj.Flags and obj.Flags.Human) or false,
            jam    = (obj.Flags and obj.Flags.Jamming) or false,
          }
        }
      end
    end
    packet.objects = objects
  end

  -- ── Radar Targets (EXPT-02) — anti-cheat gated ──
  if jarvis_sensor_export_ok then
    -- All tracked targets
    if LoGetTargetInformation then
      local raw_targets = LoGetTargetInformation() or {}
      local targets = {}
      for _, tgt in pairs(raw_targets) do
        local pos_p = (tgt.position and tgt.position.p) or {x=0, y=0, z=0}
        local vel = tgt.velocity or {x=0, y=0, z=0}
        targets[#targets + 1] = {
          id       = tgt.ID or 0,
          dist     = tgt.distance or 0,
          course   = tgt.course or 0,
          mach     = tgt.mach or 0,
          flags    = tgt.flags or 0,
          fim      = tgt.fim or 0,   -- horizontal angle in body axis
          fin      = tgt.fin or 0,   -- vertical angle in body axis
          vel      = { x = vel.x, y = vel.y, z = vel.z },
          pos      = { x = pos_p.x, y = pos_p.y, z = pos_p.z },
          jamming  = tgt.isjamming or false,
        }
      end
      packet.targets = targets
    end

    -- Locked targets only (EXPT-02)
    if LoGetLockedTargetInformation then
      local raw_locked = LoGetLockedTargetInformation() or {}
      local locked = {}
      for _, tgt in pairs(raw_locked) do
        local pos_p = (tgt.position and tgt.position.p) or {x=0, y=0, z=0}
        local vel = tgt.velocity or {x=0, y=0, z=0}
        locked[#locked + 1] = {
          id       = tgt.ID or 0,
          dist     = tgt.distance or 0,
          course   = tgt.course or 0,
          mach     = tgt.mach or 0,
          flags    = tgt.flags or 0,
          fim      = tgt.fim or 0,
          fin      = tgt.fin or 0,
          vel      = { x = vel.x, y = vel.y, z = vel.z },
          pos      = { x = pos_p.x, y = pos_p.y, z = pos_p.z },
          jamming  = tgt.isjamming or false,
        }
      end
      packet.locked = locked
    end
  end

  -- ── Payload / Weapons (EXPT-03) — NOT anti-cheat gated ──
  if LoGetPayloadInfo then
    local payload = LoGetPayloadInfo() or {}
    local stations = {}
    if payload.Stations then
      for i, stn in ipairs(payload.Stations) do
        local wep_type = stn.weapon or {}
        -- Resolve weapon name from type codes
        local wep_name = ""
        if LoGetNameByType and wep_type.level1 then
          wep_name = LoGetNameByType(
            wep_type.level1, wep_type.level2 or 0,
            wep_type.level3 or 0, wep_type.level4 or 0
          ) or ""
        end
        stations[#stations + 1] = {
          idx   = i,
          name  = wep_name,
          type  = wep_type,
          count = stn.count or 0,
        }
      end
    end
    packet.weapons = {
      current_station = payload.CurrentStation or 0,
      stations = stations,
      gun_rounds = (payload.Cannon and payload.Cannon.shells) or 0,
    }
  end

  -- ── Countermeasures (EXPT-03) ──
  if LoGetSnares then
    local cm = LoGetSnares() or {}
    packet.countermeasures = {
      chaff = cm.chaff or 0,
      flare = cm.flare or 0,
    }
  end

  -- ── Navigation Info (EXPT-04) ──
  if LoGetNavigationInfo then
    local nav = LoGetNavigationInfo() or {}
    local sys_mode = nav.SystemMode or {}
    local acs = nav.ACS or {}
    packet.nav = {
      master_mode = sys_mode.master or "OFF",
      sub_mode    = sys_mode.submode or "OFF",
      acs_mode    = acs.mode or "OFF",
      autothrust  = (acs.autothrust or 0) > 0,
    }
  end

  -- ── MCP State / Warnings (EXPT-05) ──
  if LoGetMCPState then
    local mcp = LoGetMCPState() or {}
    -- Only send active warnings to minimize packet size
    local warnings = {}
    for key, val in pairs(mcp) do
      if val == true then
        warnings[#warnings + 1] = key
      end
    end
    packet.mcp_warnings = warnings
  end

  -- ── Mechanization Info (EXPT-06) ──
  if LoGetMechInfo then
    local mech = LoGetMechInfo() or {}
    local gear = mech.gear or {}
    local flaps = mech.flaps or {}
    local spbrk = mech.speedbrakes or {}
    packet.mech = {
      gear_status = gear.value or 0,        -- 0.0=up, 1.0=down
      flaps_value = flaps.value or 0,       -- 0.0-1.0
      speedbrakes = spbrk.value or 0,       -- 0.0-1.0
    }
  end

  -- ── Anti-cheat flags for client awareness (EXPT-07) ──
  packet.permissions = {
    objects = jarvis_object_export_ok,
    sensors = jarvis_sensor_export_ok,
  }

  local ok, encoded = pcall(function()
    return jarvis_JSON:encode(packet)
  end)

  if ok and encoded then
    pcall(function()
      jarvis_udp:sendto(encoded, jarvis_host, jarvis_port)
    end)
  end
end

function LuaExportStop()
  -- Close our socket first
  if jarvis_udp then
    pcall(function() jarvis_udp:close() end)
  end
  jarvis_udp = nil
  jarvis_JSON = nil

  -- Chain upstream last
  if _prev_LuaExportStop then pcall(_prev_LuaExportStop) end
end
