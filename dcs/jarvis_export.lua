-- ═══════════════════════════════════════════════════════
-- JARVIS DCS Telemetry Exporter v2.0
-- Chain-compatible with TacView / SRS / Helios via dofile()
-- Place in: Saved Games\DCS\Scripts\Export.lua
-- ═══════════════════════════════════════════════════════

local jarvis_udp = nil
local jarvis_port = 7779
local jarvis_host = "127.0.0.1"
local jarvis_interval = 0.2   -- 5 Hz = every 200ms (bridge downsamples to 4 Hz anyway)
local jarvis_last_send = 0
local jarvis_JSON = nil

-- Tactical state machine: 3 phases spread across frames (~333ms each ≈ 1s cycle)
local jarvis_tac_phase_interval = 0.333  -- time between phases
local jarvis_last_tac_phase = 0
local jarvis_tac_phase = 0               -- 0, 1, 2 then wraps
local jarvis_tac_acc = {}                 -- accumulator for partial tactical data

-- Waypoint cache (Change 4: avoid repeated coordinate transforms)
local jarvis_cached_route = nil
local jarvis_cached_route_wp = -1         -- last CurrentWaypoint seen
local jarvis_cached_route_time = 0        -- last refresh timestamp

-- Aircraft-specific normalization constants (F-16C Viper)
local JARVIS_FUEL_INTERNAL_MAX = 3200   -- Internal tanks (kg)
local JARVIS_FUEL_EXTERNAL_MAX = 1400   -- External tank (kg)
local JARVIS_ENGINE_MAX_RPM = 10400     -- F110-GE-129 max RPM

-- Anti-cheat permissions (re-checked periodically)
local jarvis_object_export_ok = false
local jarvis_sensor_export_ok = false
local jarvis_perm_last_check = 0
local jarvis_perm_interval = 10  -- re-check every 10 seconds

-- Tactical error tracking (write error to log once, not every frame)
local jarvis_tac_err_logged = false

-- One-time tactical send diagnostic (same pattern as jarvis_diag_done)
local jarvis_tac_send_logged = false

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

  -- Guard: no socket
  if not jarvis_udp then return end

  local t = LoGetModelTime()

  -- ── High-frequency flight data (5 Hz) ──
  if t - jarvis_last_send >= jarvis_interval then
    jarvis_last_send = t
    pcall(jarvis_send_flight, t)
  end

  -- ── Re-check anti-cheat permissions periodically ──
  if t - jarvis_perm_last_check >= jarvis_perm_interval then
    jarvis_perm_last_check = t
    jarvis_object_export_ok = (LoIsObjectExportAllowed and LoIsObjectExportAllowed()) or false
    jarvis_sensor_export_ok = (LoIsSensorExportAllowed and LoIsSensorExportAllowed()) or false
  end

  -- ── Tactical state machine: one phase per ~333ms ──
  if t - jarvis_last_tac_phase >= jarvis_tac_phase_interval then
    jarvis_last_tac_phase = t
    local tac_ok, tac_err = pcall(jarvis_run_tac_phase, t, jarvis_tac_phase)
    if not tac_ok and not jarvis_tac_err_logged then
      jarvis_tac_err_logged = true
      local path = lfs and lfs.writedir and (lfs.writedir() .. "Logs/jarvis_tactical_err.log") or nil
      if path then
        local f = io.open(path, "w")
        if f then f:write("Tactical error at t=" .. tostring(t) .. " phase=" .. tostring(jarvis_tac_phase) .. ": " .. tostring(tac_err) .. "\n"); f:close() end
      end
    end
    jarvis_tac_phase = (jarvis_tac_phase + 1) % 3
  end
end

-- ── Helper: safely extract a number from a DCS table field ──
-- DCS modules return data inconsistently: sometimes {RPM=75}, sometimes {RPM={left=75}}
local function jarvis_num(tbl, ...)
  if not tbl then return 0 end
  for _, key in ipairs({...}) do
    local val = tbl[key]
    if type(val) == "number" then return val end
    if type(val) == "table" then
      -- Nested: {RPM={left=75}} or {RPM={75}}
      return val.left or val.right or val[1] or 0
    end
  end
  return 0
end

-- ── Diagnostic dump (runs once per mission to help debug field names) ──
local jarvis_diag_done = false
local function jarvis_write_diag()
  if jarvis_diag_done then return end
  jarvis_diag_done = true

  local path = lfs and lfs.writedir and (lfs.writedir() .. "Logs/jarvis_diag.log") or nil
  if not path then return end

  local f = io.open(path, "w")
  if not f then return end

  f:write("JARVIS Diagnostic Dump — " .. os.date() .. "\n\n")

  -- Dump LoGetEngineInfo
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

  -- Dump LoGetFuelData
  local ok_fuel, fdata = pcall(function() return LoGetFuelData and LoGetFuelData() end)
  if ok_fuel and fdata then
    f:write("\n=== LoGetFuelData() ===\n")
    for k, v in pairs(fdata) do
      f:write("  " .. k .. " = " .. tostring(v) .. "\n")
    end
  else
    f:write("\n=== LoGetFuelData() FAILED or nil ===\n")
  end

  -- Dump LoGetAngleOfAttack
  local ok_aoa, aoa = pcall(function() return LoGetAngleOfAttack and LoGetAngleOfAttack() end)
  f:write("\n=== LoGetAngleOfAttack() ===\n")
  f:write("  value = " .. tostring(ok_aoa and aoa or "FAILED") .. "\n")

  -- Dump permissions
  f:write("\n=== Permissions ===\n")
  f:write("  LoIsObjectExportAllowed = " .. tostring(jarvis_object_export_ok) .. "\n")
  f:write("  LoIsSensorExportAllowed = " .. tostring(jarvis_sensor_export_ok) .. "\n")

  -- Dump LoGetMechInfo
  local ok_mech, mech = pcall(function() return LoGetMechInfo and LoGetMechInfo() end)
  if ok_mech and mech then
    f:write("\n=== LoGetMechInfo() ===\n")
    for k, v in pairs(mech) do
      if type(v) == "table" then
        local parts = {}
        for sk, sv in pairs(v) do parts[#parts+1] = sk .. "=" .. tostring(sv) end
        f:write("  " .. k .. " = {" .. table.concat(parts, ", ") .. "}\n")
      else
        f:write("  " .. k .. " = " .. tostring(v) .. "\n")
      end
    end
  end

  f:write("\n=== Done ===\n")
  f:close()
end

-- ── High-frequency flight telemetry (5 Hz) ──
function jarvis_send_flight(t)
  local self_data = LoGetSelfData()
  if not self_data then return end

  local lla = self_data.LatLongAlt
  if not lla then return end

  -- Write diagnostic dump once per mission
  jarvis_write_diag()

  -- Acceleration (G-loads) — returns {x, y, z} in G units
  local acc = LoGetAccelerationUnits() or {x=0, y=1, z=0}
  -- Angular velocity — returns {x, y, z} rad/s
  local angvel = (LoGetAngularVelocity and LoGetAngularVelocity()) or {x=0, y=0, z=0}

  -- ── Engine data — handle all common DCS module formats ──
  local eng_raw = (LoGetEngineInfo and LoGetEngineInfo()) or {}
  -- RPM: try {RPM={left=pct}}, {RPM=pct}, {rpm=pct}, eng.left.RPM, etc.
  local rpm_val = jarvis_num(eng_raw, "RPM", "rpm")
  -- If RPM is 0-1 fraction, convert to percentage
  local rpm_pct = 0
  if rpm_val > 0 and rpm_val <= 1 then
    rpm_pct = rpm_val * 100       -- fraction → percentage
  elseif rpm_val > 1 and rpm_val <= 110 then
    rpm_pct = rpm_val             -- already percentage
  elseif rpm_val > 110 then
    rpm_pct = (rpm_val / JARVIS_ENGINE_MAX_RPM) * 100  -- raw RPM → percentage
  end

  -- Fuel consumption: try {FuelConsumption={left=val}}, flat, etc.
  local fuelcon = jarvis_num(eng_raw, "FuelConsumption", "fuel_consumption", "fuelConsumption")

  -- ── Fuel data — try multiple sources ──
  local fuel_int = 0
  local fuel_ext = 0

  -- Source 1: LoGetFuelData() (community API, may not exist on all modules)
  if LoGetFuelData then
    local ok_fd, fdata = pcall(LoGetFuelData)
    if ok_fd and fdata then
      fuel_int = fdata.fuel_internal or fdata.FuelInternal or fdata.fuel0 or 0
      fuel_ext = fdata.fuel_external or fdata.FuelExternal or fdata.fuel1 or 0
    end
  end

  -- Source 2: LoGetEngineInfo() often has fuel_internal/fuel_external as top-level fields
  if fuel_int == 0 then
    fuel_int = eng_raw.fuel_internal or eng_raw.FuelInternal or 0
  end
  if fuel_ext == 0 then
    fuel_ext = eng_raw.fuel_external or eng_raw.FuelExternal or 0
  end

  -- Normalize fuel to 0-1 fraction
  local fuel_int_frac = (fuel_int > 1) and math.min(1, fuel_int / JARVIS_FUEL_INTERNAL_MAX) or fuel_int
  local fuel_ext_frac = (fuel_ext > 1) and math.min(1, fuel_ext / JARVIS_FUEL_EXTERNAL_MAX) or fuel_ext

  -- ── AoA — validate and clamp to sane range ──
  local raw_aoa = (LoGetAngleOfAttack and LoGetAngleOfAttack()) or 0
  -- Sanity check: valid AoA should be within ±1.0 radians (±57°)
  -- If value is outside this, it's likely degrees or garbage — clamp to 0
  local aoa_val = raw_aoa
  if math.abs(raw_aoa) > 1.0 then
    -- Might be degrees instead of radians, or garbage
    if math.abs(raw_aoa) <= 60 then
      aoa_val = raw_aoa * math.pi / 180  -- treat as degrees → convert to radians
    else
      aoa_val = 0  -- garbage value, discard
    end
  end

  -- Gather remaining API values (no inner pcall — outer pcall at call site covers us)
  local agl = (LoGetAltitudeAboveGroundLevel and LoGetAltitudeAboveGroundLevel()) or 0
  local ias = LoGetIndicatedAirSpeed()
  local tas = (LoGetTrueAirSpeed and LoGetTrueAirSpeed()) or 0
  local vvi = (LoGetVerticalVelocity and LoGetVerticalVelocity()) or 0
  local mach = (LoGetMachNumber and LoGetMachNumber()) or 0
  local hdg = LoGetMagneticYaw()
  local rpm_pct_clamped = math.min(100, math.max(0, rpm_pct))

  -- Hand-crafted JSON via string.format — no table allocation, no JSON.lua traversal
  local encoded = string.format(
    '{"type":"telemetry","t_model":%.3f,"pos":{"lat":%.8f,"lon":%.8f,"alt_m":%.1f,"alt_agl_m":%.1f},'
    .. '"att":{"pitch_rad":%.6f,"bank_rad":%.6f,"yaw_rad":%.6f},'
    .. '"spd":{"ias_mps":%.2f,"tas_mps":%.2f,"vvi_mps":%.2f,"mach":%.4f},'
    .. '"hdg_rad":%.6f,'
    .. '"aero":{"aoa_rad":%.6f,"g":{"x":%.4f,"y":%.4f,"z":%.4f},"ang_vel":{"x":%.6f,"y":%.6f,"z":%.6f}},'
    .. '"fuel":{"internal":%.6f,"external":%.6f},'
    .. '"eng":{"rpm_pct":%.2f,"fuel_con":%.4f}}',
    t, lla.Lat, lla.Long, lla.Alt, agl,
    self_data.Pitch, self_data.Bank, self_data.Heading,
    ias, tas, vvi, mach,
    hdg,
    aoa_val, acc.x, acc.y, acc.z, angvel.x, angvel.y, angvel.z,
    fuel_int_frac, fuel_ext_frac,
    rpm_pct_clamped, fuelcon
  )

  jarvis_udp:sendto(encoded, jarvis_host, jarvis_port)
end

-- ── Tactical state machine: spread work across 3 frames ──
-- Phase 0: World objects + radar targets (heaviest — iterates all units)
-- Phase 1: Weapons + countermeasures + mech + nav
-- Phase 2: Waypoints (cached) + warnings + JSON encode + send
function jarvis_run_tac_phase(t, phase)
  local self_data = LoGetSelfData()
  if not self_data then return end

  if phase == 0 then
    -- Start fresh accumulator
    jarvis_tac_acc = { type = "tactical", t_model = t }

    -- ── World Objects (EXPT-01) — anti-cheat gated ──
    if jarvis_object_export_ok and LoGetWorldObjects then
      local raw_objects = LoGetWorldObjects("units") or {}
      local objects = {}
      local player_id = (LoGetPlayerPlaneId and LoGetPlayerPlaneId()) or -1
      local self_coal = self_data.Coalition or ""
      local sample_coal = nil  -- for diagnostic logging

      for id, obj in pairs(raw_objects) do
        if id ~= player_id and obj.LatLongAlt then
          local ot = obj.Type
          local obj_coal = obj.Coalition or ""
          if not sample_coal then sample_coal = obj_coal end
          objects[#objects + 1] = {
            id    = id,
            name  = obj.Name or "",
            type  = ot and {
              level1 = ot.level1 or 0,
              level2 = ot.level2 or 0,
              level3 = ot.level3 or 0,
              level4 = ot.level4 or 0,
            } or {},
            coal  = (obj_coal ~= "" and obj_coal ~= self_coal) and "Enemies" or "Allies",
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
      jarvis_tac_acc.objects = objects
      jarvis_tac_acc.self_coal_raw = self_coal
      jarvis_tac_acc.sample_obj_coal_raw = sample_coal
    end

    -- ── Radar Targets (EXPT-02) — anti-cheat gated ──
    if jarvis_sensor_export_ok and LoGetTargetInformation then
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
          fim      = tgt.fim or 0,
          fin      = tgt.fin or 0,
          vel      = { x = vel.x, y = vel.y, z = vel.z },
          pos      = { x = pos_p.x, y = pos_p.y, z = pos_p.z },
          jamming  = tgt.isjamming or false,
        }
      end
      jarvis_tac_acc.targets = targets
    end

    -- ── Locked Targets (EXPT-02) — anti-cheat gated ──
    if jarvis_sensor_export_ok and LoGetLockedTargetInformation then
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
      jarvis_tac_acc.locked = locked
    end

  elseif phase == 1 then
    -- ── Payload / Weapons (EXPT-03) ──
    if LoGetPayloadInfo then
      local payload = LoGetPayloadInfo() or {}
      local stations = {}
      if payload.Stations then
        for i, stn in ipairs(payload.Stations) do
          local wep_type = stn.weapon or {}
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
            type  = {
              level1 = wep_type.level1 or 0,
              level2 = wep_type.level2 or 0,
              level3 = wep_type.level3 or 0,
              level4 = wep_type.level4 or 0,
            },
            count = stn.count or 0,
          }
        end
      end
      jarvis_tac_acc.weapons = {
        current_station = payload.CurrentStation or 0,
        stations = stations,
        gun_rounds = (payload.Cannon and payload.Cannon.shells) or 0,
      }
    end

    -- ── Countermeasures (EXPT-03) ──
    if LoGetSnares then
      local cm = LoGetSnares() or {}
      jarvis_tac_acc.countermeasures = {
        chaff = cm.chaff or 0,
        flare = cm.flare or 0,
      }
    end

    -- ── Mechanization Info (EXPT-06) ──
    if LoGetMechInfo then
      local mech = LoGetMechInfo() or {}
      local gear = mech.gear or {}
      local flaps = mech.flaps or {}
      local spbrk = mech.speedbrakes or {}
      jarvis_tac_acc.mech = {
        gear_status = gear.value or 0,
        flaps_value = flaps.value or 0,
        speedbrakes = spbrk.value or 0,
      }
    end

    -- ── Navigation Info (EXPT-04) ──
    if LoGetNavigationInfo then
      local nav = LoGetNavigationInfo() or {}
      local sys_mode = nav.SystemMode or {}
      local acs = nav.ACS or {}
      jarvis_tac_acc.nav = {
        master_mode = sys_mode.master or "OFF",
        sub_mode    = sys_mode.submode or "OFF",
        acs_mode    = acs.mode or "OFF",
        autothrust  = (acs.autothrust or 0) > 0,
        current_wp  = nav.CurrentWaypoint or 0,
      }
    end

  elseif phase == 2 then
    -- ── Route / Waypoints (EXPT-04b) — cached to avoid repeated coordinate transforms ──
    if LoGetRoute then
      local current_wp = 0
      if LoGetNavigationInfo then
        local nav = LoGetNavigationInfo() or {}
        current_wp = nav.CurrentWaypoint or 0
      end

      -- Invalidate cache if: first call, waypoint changed, or 30s elapsed
      local cache_stale = (not jarvis_cached_route)
        or (current_wp ~= jarvis_cached_route_wp)
        or (t - jarvis_cached_route_time > 30)

      if cache_stale then
        local ok_route, raw_route = pcall(LoGetRoute)
        if ok_route and raw_route then
          local waypoints = {}
          local geo_fn = LoLoCoordinatesToGeoCoordinates or LoCoordinatesToGeoCoordinates
          for i, wp in ipairs(raw_route) do
            if not geo_fn then break end
            local geo_ok, geo = pcall(geo_fn, wp.x or 0, wp.z or 0)
            if not geo_ok or not geo then break end
            waypoints[#waypoints + 1] = {
              idx  = i,
              lat  = geo.latitude or 0,
              lon  = geo.longitude or 0,
              alt  = wp.alt or 0,
              name = wp.name or ("WP" .. i),
            }
          end
          if #waypoints > 0 then
            jarvis_cached_route = waypoints
          end
          jarvis_cached_route_wp = current_wp
          jarvis_cached_route_time = t
        end
      end

      if jarvis_cached_route then
        jarvis_tac_acc.route = jarvis_cached_route
      end
    end

    -- ── MCP State / Warnings (EXPT-05) ──
    if LoGetMCPState then
      local mcp = LoGetMCPState() or {}
      local warnings = {}
      for key, val in pairs(mcp) do
        if val == true then
          warnings[#warnings + 1] = key
        end
      end
      jarvis_tac_acc.mcp_warnings = warnings
    end

    -- ── Anti-cheat flags (EXPT-07) ──
    jarvis_tac_acc.permissions = {
      objects = jarvis_object_export_ok,
      sensors = jarvis_sensor_export_ok,
    }

    -- ── Encode + Send ──
    -- Tactical still uses JSON.lua (complex nested structure, not fixed schema)
    if jarvis_JSON then
      -- Strip diagnostic fields before encoding (only used in log below)
      local self_coal_raw = jarvis_tac_acc.self_coal_raw
      local sample_obj_coal_raw = jarvis_tac_acc.sample_obj_coal_raw
      jarvis_tac_acc.self_coal_raw = nil
      jarvis_tac_acc.sample_obj_coal_raw = nil

      local ok, encoded = pcall(function()
        return jarvis_JSON:encode(jarvis_tac_acc)
      end)

      local send_ok, send_err = false, "skipped (encode failed)"
      if ok and encoded then
        send_ok, send_err = pcall(function()
          jarvis_udp:sendto(encoded, jarvis_host, jarvis_port)
        end)
      end

      -- One-time diagnostic log
      if not jarvis_tac_send_logged then
        jarvis_tac_send_logged = true
        local path = lfs and lfs.writedir and (lfs.writedir() .. "Logs/jarvis_tactical_send.log") or nil
        if path then
          local f = io.open(path, "w")
          if f then
            f:write("JARVIS Tactical Send Diagnostic — " .. os.date() .. "\n\n")
            f:write("=== Packet Sections ===\n")
            local packet = jarvis_tac_acc
            f:write("  objects:         " .. tostring(packet.objects ~= nil) .. (packet.objects and (" (" .. #packet.objects .. " items)") or "") .. "\n")
            f:write("  self_coalition:       " .. tostring(self_coal_raw or "N/A") .. "\n")
            f:write("  sample_obj_coalition: " .. tostring(sample_obj_coal_raw or "N/A") .. "\n")
            f:write("  targets:         " .. tostring(packet.targets ~= nil) .. (packet.targets and (" (" .. #packet.targets .. " items)") or "") .. "\n")
            f:write("  locked:          " .. tostring(packet.locked ~= nil) .. (packet.locked and (" (" .. #packet.locked .. " items)") or "") .. "\n")
            f:write("  weapons:         " .. tostring(packet.weapons ~= nil) .. "\n")
            f:write("  countermeasures: " .. tostring(packet.countermeasures ~= nil) .. "\n")
            f:write("  nav:             " .. tostring(packet.nav ~= nil) .. "\n")
            f:write("  route:           " .. tostring(packet.route ~= nil) .. (packet.route and (" (" .. #packet.route .. " waypoints)") or "") .. "\n")
            f:write("  mcp_warnings:    " .. tostring(packet.mcp_warnings ~= nil) .. "\n")
            f:write("  mech:            " .. tostring(packet.mech ~= nil) .. "\n")
            f:write("  permissions:     " .. tostring(packet.permissions ~= nil) .. "\n")
            f:write("\n=== JSON Encode ===\n")
            f:write("  ok:   " .. tostring(ok) .. "\n")
            if ok and encoded then
              f:write("  size: " .. tostring(#encoded) .. " bytes\n")
            else
              f:write("  error: " .. tostring(encoded) .. "\n")
            end
            f:write("\n=== UDP Send ===\n")
            f:write("  ok:    " .. tostring(send_ok) .. "\n")
            if not send_ok then
              f:write("  error: " .. tostring(send_err) .. "\n")
            end
            f:write("  host:  " .. jarvis_host .. ":" .. tostring(jarvis_port) .. "\n")
            f:write("\n=== API Availability ===\n")
            f:write("  LoCoordinatesToGeoCoordinates:   " .. tostring(LoCoordinatesToGeoCoordinates ~= nil) .. "\n")
            f:write("  LoLoCoordinatesToGeoCoordinates: " .. tostring(LoLoCoordinatesToGeoCoordinates ~= nil) .. "\n")
            f:write("  LoGetWorldObjects:               " .. tostring(LoGetWorldObjects ~= nil) .. "\n")
            f:write("  LoGetTargetInformation:          " .. tostring(LoGetTargetInformation ~= nil) .. "\n")
            f:write("  LoGetLockedTargetInformation:    " .. tostring(LoGetLockedTargetInformation ~= nil) .. "\n")
            f:write("  LoGetPayloadInfo:                " .. tostring(LoGetPayloadInfo ~= nil) .. "\n")
            f:write("  LoGetSnares:                     " .. tostring(LoGetSnares ~= nil) .. "\n")
            f:write("  LoGetNavigationInfo:             " .. tostring(LoGetNavigationInfo ~= nil) .. "\n")
            f:write("  LoGetRoute:                      " .. tostring(LoGetRoute ~= nil) .. "\n")
            f:write("  LoGetMCPState:                   " .. tostring(LoGetMCPState ~= nil) .. "\n")
            f:write("  LoGetMechInfo:                   " .. tostring(LoGetMechInfo ~= nil) .. "\n")
            f:write("\n=== Permissions ===\n")
            f:write("  object_export_ok: " .. tostring(jarvis_object_export_ok) .. "\n")
            f:write("  sensor_export_ok: " .. tostring(jarvis_sensor_export_ok) .. "\n")
            f:write("\n=== Done ===\n")
            f:close()
          end
        end
      end
    end

    -- Reset accumulator for next cycle
    jarvis_tac_acc = {}
  end
end

function LuaExportStop()
  -- Close our socket first
  if jarvis_udp then
    pcall(function() jarvis_udp:close() end)
  end
  jarvis_udp = nil
  jarvis_JSON = nil

  -- Reset tactical state
  jarvis_tac_acc = {}
  jarvis_tac_phase = 0
  jarvis_cached_route = nil

  -- Chain upstream last
  if _prev_LuaExportStop then pcall(_prev_LuaExportStop) end
end
