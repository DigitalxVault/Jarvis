"""Stream merger: combines GrpcState + CockpitState into a TelemetryPacket.

The Normalizer holds references to both state objects and produces a
TelemetryPacket on demand. It handles partial / missing data gracefully
and exposes staleness helpers.
"""
from __future__ import annotations

import time
from typing import Optional

from jarvis_bridge.grpc_client import GrpcState
from jarvis_bridge.models import (
    Aero,
    AngularVelocity,
    Attitude,
    Engine,
    Fuel,
    GForce,
    Position,
    Speed,
    TelemetryPacket,
)
from jarvis_bridge.udp_listener import CockpitState

# Time (seconds) after last update before a stream is considered stale.
_STALENESS_S: float = 3.0


def _stale(last_update: float) -> bool:
    """Return True if last_update is 0 or older than _STALENESS_S."""
    if last_update == 0.0:
        return True
    return (time.monotonic() - last_update) > _STALENESS_S


def merge(grpc: GrpcState, cockpit: CockpitState) -> TelemetryPacket:
    """Merge GrpcState and CockpitState into a TelemetryPacket.

    Uses t_model from whichever source is fresher. Falls back to 0.0
    when no data has been received.
    """
    # Use the most recent model time as the packet timestamp.
    t_model = max(grpc.t_model, cockpit.t_model)

    pos = Position(
        lat=grpc.lat,
        lon=grpc.lon,
        alt_m=grpc.alt_m,
        alt_agl_m=cockpit.alt_agl_m if cockpit.alt_agl_m != 0.0 else None,
    )

    att = Attitude(
        pitch_rad=grpc.pitch_rad,
        bank_rad=grpc.bank_rad,
        yaw_rad=grpc.yaw_rad,
    )

    spd = Speed(
        ias_mps=cockpit.ias_mps,
        tas_mps=grpc.tas_mps if grpc.tas_mps != 0.0 else None,
        vvi_mps=cockpit.vvi_mps if cockpit.vvi_mps != 0.0 else None,
        mach=cockpit.mach,
    )

    aero = Aero(
        aoa_rad=cockpit.aoa_rad,
        g=GForce(x=cockpit.g_x, y=cockpit.g_y, z=cockpit.g_z),
        ang_vel=AngularVelocity(
            x=cockpit.ang_vel_x,
            y=cockpit.ang_vel_y,
            z=cockpit.ang_vel_z,
        ),
    )

    fuel = Fuel(
        internal=cockpit.fuel_internal,
        external=cockpit.fuel_external,
    )

    eng = Engine(
        rpm_pct=cockpit.rpm_pct,
        fuel_con=cockpit.fuel_con,
    )

    return TelemetryPacket(
        type="telemetry",
        t_model=t_model,
        pos=pos,
        att=att,
        spd=spd,
        hdg_rad=grpc.hdg_rad,
        aero=aero,
        fuel=fuel,
        eng=eng,
    )


def normalize_for_aircraft(packet: TelemetryPacket, aircraft_type: str) -> TelemetryPacket:
    """Apply per-aircraft normalization to a TelemetryPacket.

    Placeholder — aircraft-specific corrections (unit scale, bias offsets)
    will be added here in future plans.
    """
    # F-16C normalization: fuel fractions already normalized by Lua exporter.
    # Additional per-aircraft corrections go here.
    _ = aircraft_type  # reserved for future use
    return packet


class Normalizer:
    """Stateful merger that converts live GrpcState + CockpitState to TelemetryPacket.

    Attributes:
        grpc_state: Latest state from the gRPC stream.
        cockpit_state: Latest state from the UDP cockpit listener.
    """

    def __init__(self) -> None:
        self.grpc_state: GrpcState = GrpcState()
        self.cockpit_state: CockpitState = CockpitState()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def has_data(self) -> bool:
        """True if at least one stream has ever received data."""
        return (
            self.grpc_state.last_update != 0.0
            or self.cockpit_state.last_update != 0.0
        )

    @property
    def dcs_active(self) -> bool:
        """True if either stream received data within the staleness window."""
        return (
            not _stale(self.grpc_state.last_update)
            or not _stale(self.cockpit_state.last_update)
        )

    # ------------------------------------------------------------------
    # Public API
    # ------------------------------------------------------------------

    def get_packet(self) -> Optional[TelemetryPacket]:
        """Return the latest merged TelemetryPacket, or None if no data yet."""
        if not self.has_data:
            return None
        return merge(self.grpc_state, self.cockpit_state)
