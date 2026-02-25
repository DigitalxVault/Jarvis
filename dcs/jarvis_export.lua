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

    return jarvis_JSON:encode({
      type    = "telemetry",
      t_model = t,
      pos     = {
        lat   = lla.Lat,
        lon   = lla.Long,
        alt_m = lla.Alt
      },
      att     = {
        pitch_rad = self_data.Pitch,
        bank_rad  = self_data.Bank,
        yaw_rad   = self_data.Heading
      },
      spd     = {
        ias_mps = LoGetIndicatedAirSpeed(),
        mach    = (LoGetMachNumber and LoGetMachNumber()) or 0
      },
      hdg_rad = LoGetMagneticYaw()
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
