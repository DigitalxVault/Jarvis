-- ═══════════════════════════════════════════════════════
-- JARVIS DCS Telemetry Exporter
-- Chain-compatible with TacView / SRS / Helios via dofile()
-- Place in: Saved Games\DCS\Scripts\Export.lua
-- ═══════════════════════════════════════════════════════

local jarvis_udp = nil
local jarvis_port = 7779
local jarvis_host = "127.0.0.1"
local jarvis_interval = 0.1   -- 10 Hz = every 100ms
local jarvis_last_send = 0
local jarvis_JSON = nil

-- Aircraft-specific normalization constants (F-16C Viper)
local JARVIS_FUEL_INTERNAL_MAX = 3200   -- Internal tanks (kg)
local JARVIS_FUEL_EXTERNAL_MAX = 1400   -- External tank (kg)
local JARVIS_ENGINE_MAX_RPM = 10400     -- F110-GE-129 max RPM

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
end

function LuaExportAfterNextFrame()
  -- Chain upstream first
  if _prev_LuaExportAfterNextFrame then pcall(_prev_LuaExportAfterNextFrame) end

  -- Guard: no socket or no JSON encoder
  if not jarvis_udp or not jarvis_JSON then return end

  -- Throttle to 10 Hz using mission model time
  local t = LoGetModelTime()
  if t - jarvis_last_send < jarvis_interval then return end
  jarvis_last_send = t

  -- Gather telemetry inside pcall for safety
  local ok, encoded = pcall(function()
    local self_data = LoGetSelfData()
    if not self_data then return nil end

    local lla = self_data.LatLongAlt
    if not lla then return nil end

    -- Acceleration (G-loads) — returns {x, y, z}
    local acc = LoGetAccelerationUnits() or {x=0, y=1, z=0}
    -- Angular velocity — returns {x, y, z} rad/s
    local angvel = (LoGetAngularVelocity and LoGetAngularVelocity()) or {x=0, y=0, z=0}
    -- Engine info — returns table per engine, we take engine 1
    local eng_raw = (LoGetEngineInfo and LoGetEngineInfo()) or {}
    local eng1 = eng_raw.left or eng_raw[1] or {}

    return jarvis_JSON:encode({
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
        rpm_pct  = math.min(100, ((eng1.RPM or 0) / JARVIS_ENGINE_MAX_RPM) * 100),
        fuel_con = eng1.fuel_consumption or 0
      }
    })
  end)

  -- Send if encoding succeeded
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
