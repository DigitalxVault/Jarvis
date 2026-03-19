"""DCS command executor — gRPC Lua injection via custom.Eval.

Receives parsed command payloads from CommandListener and executes them
against the DCS-gRPC server by injecting Lua scripts. All position conversion
(BRA/simple → absolute lat/lon) is expected to have been done client-side;
the executor receives absolute lat/lon/alt_m coordinates.
"""
from __future__ import annotations

import logging
import sys
import uuid
from typing import Any

import grpc

# Inject the generated stubs into the path at module load
import os as _os
_GENERATED_DIR = _os.path.join(_os.path.dirname(__file__), "..", "..", "generated")
if _GENERATED_DIR not in sys.path:
    sys.path.insert(0, _GENERATED_DIR)

from dcs.custom.v0 import custom_pb2, custom_pb2_grpc  # type: ignore[import]

log = logging.getLogger(__name__)


class CommandExecutor:
    """Executes DCS commands via gRPC (custom.Eval Lua injection).

    Opens its own gRPC channel during construction. Callers must call close()
    during shutdown to release the channel.
    """

    def __init__(self, target: str | None = None) -> None:
        target = target or _os.environ.get("DCS_GRPC_HOST", "localhost:50051")
        self._target = target
        # Open async gRPC channel — reused across calls
        self._channel = grpc.aio.insecure_channel(target)
        self._custom_stub = custom_pb2_grpc.CustomServiceStub(self._channel)

    async def close(self) -> None:
        """Close the gRPC channel. Must be called during shutdown."""
        await self._channel.close()

    # ------------------------------------------------------------------
    # Public dispatcher
    # ------------------------------------------------------------------

    async def execute(self, action: str, payload: dict[str, Any]) -> tuple[bool, str]:
        """Dispatch action to handler. Returns (success, message)."""
        try:
            if action == "spawn_unit":
                return await self._spawn_unit(payload)
            elif action == "set_ai_task":
                return await self._set_ai_task(payload)
            elif action == "inject_waypoint":
                return await self._inject_waypoint(payload)
            elif action == "config_alert":
                # Alert configuration is web-only — bridge doesn't handle it
                return True, "Alert config is web-only"
            else:
                return False, f"Unknown action: {action}"
        except grpc.RpcError as exc:  # type: ignore[attr-defined]
            code = exc.code()  # type: ignore[union-attr]
            if code == grpc.StatusCode.UNIMPLEMENTED:
                return False, "DCS-gRPC eval not enabled — set evalEnabled=true in config.lua"
            if code == grpc.StatusCode.UNAVAILABLE:
                return False, "DCS-gRPC unavailable — is the server running?"
            return False, f"gRPC error ({code.name}): {exc.details()}"  # type: ignore[union-attr]
        except Exception as exc:  # noqa: BLE001
            log.debug("CommandExecutor.execute error: %s", exc)
            return False, str(exc)

    # ------------------------------------------------------------------
    # Spawn unit
    # ------------------------------------------------------------------

    async def _spawn_unit(self, payload: dict[str, Any]) -> tuple[bool, str]:
        unit_type: str = payload.get("unitType", "MiG-29A")
        count: int = int(payload.get("count", 1))
        skill: str = payload.get("skill", "High")
        task: str = payload.get("task", "CAP")
        position: dict = payload.get("position", {})

        # Expect absolute position (client-side conversion already done)
        lat: float = float(position.get("lat", 0.0))
        lon: float = float(position.get("lon", 0.0))
        alt_m: float = float(position.get("altitude_m", position.get("altitude_ft", 10000) * 0.3048))

        group_suffix = uuid.uuid4().hex[:6].upper()
        group_name = f"JARVIS-{group_suffix}"

        # Build unit entries for Lua (slight lateral offset per unit)
        units_lua = ""
        for i in range(1, count + 1):
            unit_name = f"{group_name}-{i}"
            offset = (i - 1) * 50  # 50m spacing in X
            units_lua += f"""
      [{i}] = {{
        ["name"] = "{unit_name}",
        ["type"] = "{unit_type}",
        ["skill"] = "{skill}",
        ["playerCanDrive"] = false,
        ["x"] = pos.x + {offset},
        ["y"] = pos.z,
        ["alt"] = {alt_m:.1f},
        ["heading"] = 0,
        ["speed"] = 200,
        ["onboard_num"] = "0{i:02d}",
      }},"""

        lua_script = f"""
local lat_rad = {lat:.8f} * math.pi / 180
local lon_rad = {lon:.8f} * math.pi / 180
local pos = coord.LLtoLO(lat_rad, lon_rad, {alt_m:.1f})
local groupData = {{
  ["name"] = "{group_name}",
  ["task"] = "{task}",
  ["uncontrolled"] = false,
  ["units"] = {{{units_lua}
  }},
}}
coalition.addGroup(country.id.RUSSIA, Group.Category.AIRPLANE, groupData)
return "{group_name}"
"""
        log.debug("Spawning %dx %s as %s", count, unit_type, group_name)

        resp = await self._custom_stub.Eval(custom_pb2.EvalRequest(lua=lua_script))
        log.debug("Eval response: %s", resp.json)
        return True, f"Spawned {count}x {unit_type} ({group_name})"

    # ------------------------------------------------------------------
    # Set AI task
    # ------------------------------------------------------------------

    async def _set_ai_task(self, payload: dict[str, Any]) -> tuple[bool, str]:
        group_name: str = payload.get("groupName", "")
        task: str = payload.get("task", "CAP")

        if not group_name:
            return False, "groupName is required"

        lua_script = f"""
local grp = Group.getByName("{group_name}")
if not grp then
  return "Group not found: {group_name}"
end
local ctrl = grp:getController()
ctrl:setTask({{id = "{task}", params = {{}}}})
return "ok"
"""
        resp = await self._custom_stub.Eval(custom_pb2.EvalRequest(lua=lua_script))
        result = resp.json.strip().strip('"')
        if result.startswith("Group not found"):
            return False, result
        return True, f"Task set to {task} for {group_name}"

    # ------------------------------------------------------------------
    # Inject waypoints
    # ------------------------------------------------------------------

    async def _inject_waypoint(self, payload: dict[str, Any]) -> tuple[bool, str]:
        waypoints: list[dict] = payload.get("waypoints", [])
        if not waypoints:
            return False, "No waypoints provided"

        # Build Lua waypoint entries
        wp_entries = ""
        for i, wp in enumerate(waypoints, start=1):
            lat_rad = wp.get("lat", 0.0) * 3.14159265358979 / 180
            lon_rad = wp.get("lon", 0.0) * 3.14159265358979 / 180
            alt_m = wp.get("altitude_ft", 10000) * 0.3048
            name = wp.get("name", f"WP{i}").replace('"', "'")
            wp_entries += f"""
    local wp_pos_{i} = coord.LLtoLO({lat_rad:.8f}, {lon_rad:.8f}, {alt_m:.1f})
    mission.params.route.points[{i}] = {{
      x = wp_pos_{i}.x, y = wp_pos_{i}.z, alt = {alt_m:.1f},
      type = "Turning Point", action = "Turning Point",
      name = "{name}",
    }}"""

        lua_script = f"""
local player = world.getPlayer()
if not player then return "No player unit" end
local ctrl = player:getController()
local mission = {{id = "Mission", params = {{route = {{points = {{}}}}}}}}
{wp_entries}
ctrl:setTask(mission)
return "ok"
"""
        resp = await self._custom_stub.Eval(custom_pb2.EvalRequest(lua=lua_script))
        result = resp.json.strip().strip('"')
        if result == "No player unit":
            return False, result
        return True, f"Injected {len(waypoints)} waypoint(s)"
