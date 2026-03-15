-- ═══════════════════════════════════════════════════════
-- JARVIS DCS Cockpit Exporter v3.0 (Minimal)
-- Sends ONLY cockpit fields not available from DCS-gRPC:
--   IAS, Mach, VVI, AGL, Fuel, Engine, AoA, G-loads, Angular velocity
-- Position, attitude, heading, TAS come from DCS-gRPC instead.
--
-- Packet type: "cockpit" (distinguishes from legacy "telemetry")
-- UDP: 127.0.0.1:7779  Rate: 10 Hz
--
-- Chain-compatible with TacView / SRS / Helios via dofile()
-- Place in: Saved Games\DCS\Scripts\Export.lua
-- ═══════════════════════════════════════════════════════

local jarvis_m_udp       = nil
local jarvis_m_port      = 7779
local jarvis_m_host      = "127.0.0.1"
local jarvis_m_interval  = 0.1   -- 10 Hz
local jarvis_m_last_send = 0

-- Aircraft-specific normalization constants (F-16C Viper)
local JARVIS_FUEL_INTERNAL_MAX = 3200   -- Internal tanks (kg)
local JARVIS_FUEL_EXTERNAL_MAX = 1400   -- External tank (kg)
local JARVIS_ENGINE_MAX_RPM    = 10400  -- F110-GE-129 max RPM

-- ── Chain existing Export.lua functions ──
local _prev_LuaExportStart          = LuaExportStart
local _prev_LuaExportAfterNextFrame = LuaExportAfterNextFrame
local _prev_LuaExportStop           = LuaExportStop

function LuaExportStart()
  if _prev_LuaExportStart then pcall(_prev_LuaExportStart) end

  package.path  = package.path  .. ";.\\LuaSocket\\?.lua"
  package.cpath = package.cpath .. ";.\\LuaSocket\\?.dll"

  local ok_sock, socket = pcall(require, "socket")
  if ok_sock and socket then
    jarvis_m_udp = socket.udp()
    jarvis_m_udp:settimeout(0)
  end

  -- One-time diagnostic dump
  jarvis_m_diag_done = false
end

function LuaExportAfterNextFrame()
  if _prev_LuaExportAfterNextFrame then pcall(_prev_LuaExportAfterNextFrame) end
  if not jarvis_m_udp then return end

  local t = LoGetModelTime()
  if t - jarvis_m_last_send >= jarvis_m_interval then
    jarvis_m_last_send = t
    pcall(jarvis_m_send_cockpit, t)
  end
end

-- ── Helper: safely extract a number from a DCS table field ──
local function jarvis_m_num(tbl, ...)
  if not tbl then return 0 end
  for _, key in ipairs({...}) do
    local val = tbl[key]
    if type(val) == "number" then return val end
    if type(val) == "table" then
      return val.left or val.right or val[1] or 0
    end
  end
  return 0
end

-- ── Diagnostic dump (once per mission) ──
local jarvis_m_diag_done = false
local function jarvis_m_write_diag()
  if jarvis_m_diag_done then return end
  jarvis_m_diag_done = true

  local path = lfs and lfs.writedir and (lfs.writedir() .. "Logs/jarvis_minimal_diag.log") or nil
  if not path then return end
  local f = io.open(path, "w")
  if not f then return end

  f:write("JARVIS Minimal Cockpit Exporter Diagnostic — " .. os.date() .. "\n\n")

  local ok_eng, eng = pcall(function() return LoGetEngineInfo and LoGetEngineInfo() end)
  if ok_eng and eng then
    f:write("=== LoGetEngineInfo() ===\n")
    for k, v in pairs(eng) do
      if type(v) == "table" then
        local parts = {}
        for sk, sv in pairs(v) do parts[#parts+1] = sk .. "=" .. tostring(sv) end
        f:write("  " .. k .. " = {" .. table.concat(parts, ", ") .. "}\n")
      else
        f:write("  " .. k .. " = " .. tostring(v) .. "\n")
      end
    end
  else
    f:write("=== LoGetEngineInfo() FAILED or nil ===\n")
  end

  local ok_fuel, fdata = pcall(function() return LoGetFuelData and LoGetFuelData() end)
  if ok_fuel and fdata then
    f:write("\n=== LoGetFuelData() ===\n")
    for k, v in pairs(fdata) do
      f:write("  " .. k .. " = " .. tostring(v) .. "\n")
    end
  else
    f:write("\n=== LoGetFuelData() FAILED or nil ===\n")
  end

  local ok_aoa, aoa = pcall(function() return LoGetAngleOfAttack and LoGetAngleOfAttack() end)
  f:write("\n=== LoGetAngleOfAttack() ===\n")
  f:write("  value = " .. tostring(ok_aoa and aoa or "FAILED") .. "\n")

  f:write("\n=== Done ===\n")
  f:close()
end

-- ── Cockpit-only telemetry send ──
function jarvis_m_send_cockpit(t)
  -- Write diagnostic dump once per mission
  jarvis_m_write_diag()

  -- ── IAS / Mach / VVI / AGL ──
  local ias  = (LoGetIndicatedAirSpeed and LoGetIndicatedAirSpeed()) or 0
  local mach = (LoGetMachNumber and LoGetMachNumber()) or 0
  local vvi  = (LoGetVerticalVelocity and LoGetVerticalVelocity()) or 0
  local agl  = (LoGetAltitudeAboveGroundLevel and LoGetAltitudeAboveGroundLevel()) or 0

  -- ── Engine data ──
  local eng_raw  = (LoGetEngineInfo and LoGetEngineInfo()) or {}
  local rpm_val  = jarvis_m_num(eng_raw, "RPM", "rpm")
  local rpm_pct  = 0
  if rpm_val > 0 and rpm_val <= 1 then
    rpm_pct = rpm_val * 100
  elseif rpm_val > 1 and rpm_val <= 110 then
    rpm_pct = rpm_val
  elseif rpm_val > 110 then
    rpm_pct = (rpm_val / JARVIS_ENGINE_MAX_RPM) * 100
  end
  local fuelcon = jarvis_m_num(eng_raw, "FuelConsumption", "fuel_consumption", "fuelConsumption")

  -- ── Fuel data ──
  local fuel_int = 0
  local fuel_ext = 0
  if LoGetFuelData then
    local ok_fd, fdata = pcall(LoGetFuelData)
    if ok_fd and fdata then
      fuel_int = fdata.fuel_internal or fdata.FuelInternal or fdata.fuel0 or 0
      fuel_ext = fdata.fuel_external or fdata.FuelExternal or fdata.fuel1 or 0
    end
  end
  if fuel_int == 0 then
    fuel_int = eng_raw.fuel_internal or eng_raw.FuelInternal or 0
  end
  if fuel_ext == 0 then
    fuel_ext = eng_raw.fuel_external or eng_raw.FuelExternal or 0
  end
  local fuel_int_frac = (fuel_int > 1) and math.min(1, fuel_int / JARVIS_FUEL_INTERNAL_MAX) or fuel_int
  local fuel_ext_frac = (fuel_ext > 1) and math.min(1, fuel_ext / JARVIS_FUEL_EXTERNAL_MAX) or fuel_ext

  -- ── AoA (validate range) ──
  local raw_aoa = (LoGetAngleOfAttack and LoGetAngleOfAttack()) or 0
  local aoa_val = raw_aoa
  if math.abs(raw_aoa) > 1.0 then
    if math.abs(raw_aoa) <= 60 then
      aoa_val = raw_aoa * math.pi / 180  -- degrees → radians
    else
      aoa_val = 0  -- garbage value, discard
    end
  end

  -- ── G-loads and angular velocity ──
  local acc    = LoGetAccelerationUnits() or {x=0, y=1, z=0}
  local angvel = (LoGetAngularVelocity and LoGetAngularVelocity()) or {x=0, y=0, z=0}

  -- ── Clamp ──
  local rpm_pct_c = math.min(100, math.max(0, rpm_pct))

  -- ── Hand-crafted JSON (no table allocation, no JSON.lua) ──
  local encoded = string.format(
    '{"type":"cockpit","t_model":%.3f,'
    .. '"ias_mps":%.2f,"mach":%.4f,"vvi_mps":%.2f,"alt_agl_m":%.1f,'
    .. '"fuel":{"internal":%.6f,"external":%.6f},'
    .. '"eng":{"rpm_pct":%.2f,"fuel_con":%.4f},'
    .. '"aero":{"aoa_rad":%.6f,"g":{"x":%.4f,"y":%.4f,"z":%.4f},"ang_vel":{"x":%.6f,"y":%.6f,"z":%.6f}}}',
    t,
    ias, mach, vvi, agl,
    fuel_int_frac, fuel_ext_frac,
    rpm_pct_c, fuelcon,
    aoa_val, acc.x, acc.y, acc.z, angvel.x, angvel.y, angvel.z
  )

  jarvis_m_udp:sendto(encoded, jarvis_m_host, jarvis_m_port)
end

function LuaExportStop()
  if jarvis_m_udp then
    pcall(function() jarvis_m_udp:close() end)
  end
  jarvis_m_udp = nil
  if _prev_LuaExportStop then pcall(_prev_LuaExportStop) end
end
