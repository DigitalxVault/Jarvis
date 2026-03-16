"""Async gRPC client for DCS-gRPC (localhost:50051).

Uses MissionService.StreamUnits to receive unit state updates.
Extracts the player unit and stores the latest state in GrpcState.
"""
from __future__ import annotations

import logging
import math
import sys
import time
from dataclasses import dataclass, field
from pathlib import Path

# Add generated/ to sys.path so protobuf stubs are importable.
_GENERATED_DIR = str(Path(__file__).parent.parent.parent / "generated")
if _GENERATED_DIR not in sys.path:
    sys.path.insert(0, _GENERATED_DIR)

import grpc.aio  # noqa: E402 — must come after sys.path modification

from dcs.mission.v0 import mission_pb2, mission_pb2_grpc  # noqa: E402

log = logging.getLogger(__name__)

_GRPC_TARGET = "localhost:50051"


@dataclass
class GrpcState:
    """Latest positional / kinematic state received from DCS-gRPC."""

    lat: float = 0.0
    lon: float = 0.0
    alt_m: float = 0.0
    pitch_rad: float = 0.0
    bank_rad: float = 0.0
    yaw_rad: float = 0.0
    hdg_rad: float = 0.0
    tas_mps: float = 0.0
    aircraft_type: str = ""
    t_model: float = 0.0
    last_update: float = field(default_factory=float)


class GrpcClient:
    """Async gRPC client that streams unit data from DCS-gRPC.

    Usage::

        client = GrpcClient()
        asyncio.create_task(client.run())
        # later: client.state.lat, client.connected
    """

    def __init__(self, target: str = _GRPC_TARGET) -> None:
        self._target = target
        self.state: GrpcState = GrpcState()
        self._connected: bool = False
        self._ever_connected: bool = False

    @property
    def connected(self) -> bool:
        """True while the gRPC stream is active and receiving data."""
        return self._connected

    @property
    def ever_connected(self) -> bool:
        """True if gRPC has connected at least once this session."""
        return self._ever_connected

    async def run(self) -> None:
        """Connect and stream units; logs error on failure then returns."""
        log.info("gRPC: connecting to %s", self._target)
        try:
            async with grpc.aio.insecure_channel(self._target) as channel:
                stub = mission_pb2_grpc.MissionServiceStub(channel)
                request = mission_pb2.StreamUnitsRequest(poll_rate=1)
                self._connected = True
                self._ever_connected = True
                log.info("gRPC: stream started (StreamUnits, poll_rate=1)")
                async for response in stub.StreamUnits(request):
                    self._process_response(response)
        except grpc.aio.AioRpcError as exc:
            log.error("gRPC: stream error — %s: %s", exc.code(), exc.details())
        except Exception as exc:  # noqa: BLE001
            log.error("gRPC: unexpected error — %s", exc)
        finally:
            self._connected = False
            log.info("gRPC: stream ended")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _process_response(self, response: mission_pb2.StreamUnitsResponse) -> None:
        """Extract player unit data from a StreamUnitsResponse."""
        # Only process responses that carry a unit (not UnitGone).
        if not response.HasField("unit"):
            return

        unit = response.unit

        # Prefer player-controlled unit; fall back to any unit present.
        if not unit.player_name:
            return

        pos = unit.position
        ori = unit.orientation
        vel = unit.velocity

        # Velocity magnitude → TAS (m/s).
        vx = vel.velocity.x if vel.HasField("velocity") else 0.0
        vy = vel.velocity.y if vel.HasField("velocity") else 0.0
        vz = vel.velocity.z if vel.HasField("velocity") else 0.0
        tas_mps = math.sqrt(vx * vx + vy * vy + vz * vz)

        self.state = GrpcState(
            lat=pos.lat,
            lon=pos.lon,
            alt_m=pos.alt,
            pitch_rad=ori.pitch,
            bank_rad=ori.roll,
            yaw_rad=ori.yaw,
            hdg_rad=ori.heading,
            tas_mps=tas_mps,
            aircraft_type=unit.type,
            t_model=response.time,
            last_update=time.monotonic(),
        )
