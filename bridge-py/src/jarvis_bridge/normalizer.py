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
from jarvis_bridge.udp_listener import CockpitState, UdpPositionState

# Time (seconds) after last update before a stream is considered stale.
_STALENESS_S: float = 3.0


def _stale(last_update: float) -> bool:
    """Return True if last_update is 0 or older than _STALENESS_S."""
    if last_update == 0.0:
        return True
    return (time.monotonic() - last_update) > _STALENESS_S


def merge(
    grpc: GrpcState,
    cockpit: CockpitState,
    udp_pos: UdpPositionState | None = None,
) -> TelemetryPacket:
    """Merge GrpcState + CockpitState (+ optional UDP position) into a TelemetryPacket.

    When gRPC has never connected (``grpc.last_update == 0.0``) but we have
    UDP position data from v2.0 ``"telemetry"`` packets, the UDP position is
    used as a fallback for lat/lon/alt, attitude, heading, and TAS.
    """
    # Decide position/attitude source: gRPC preferred, UDP fallback.
    grpc_available = grpc.last_update != 0.0
    udp_pos_available = udp_pos is not None and udp_pos.last_update != 0.0

    # Use the most recent model time as the packet timestamp.
    t_model = max(grpc.t_model, cockpit.t_model)
    if udp_pos_available:
        t_model = max(t_model, udp_pos.t_model)  # type: ignore[union-attr]

    if grpc_available:
        # gRPC connected — use it for position/attitude
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
        hdg_rad = grpc.hdg_rad
        tas_mps = grpc.tas_mps if grpc.tas_mps != 0.0 else None
    elif udp_pos_available:
        assert udp_pos is not None  # for type checker
        # gRPC never connected — fall back to UDP position data
        pos = Position(
            lat=udp_pos.lat,
            lon=udp_pos.lon,
            alt_m=udp_pos.alt_m,
            alt_agl_m=cockpit.alt_agl_m if cockpit.alt_agl_m != 0.0 else None,
        )
        att = Attitude(
            pitch_rad=udp_pos.pitch_rad,
            bank_rad=udp_pos.bank_rad,
            yaw_rad=udp_pos.yaw_rad,
        )
        hdg_rad = udp_pos.hdg_rad
        tas_mps = udp_pos.tas_mps if udp_pos.tas_mps != 0.0 else None
    else:
        # No position data at all
        pos = Position(lat=0.0, lon=0.0, alt_m=0.0, alt_agl_m=None)
        att = Attitude(pitch_rad=0.0, bank_rad=0.0, yaw_rad=0.0)
        hdg_rad = 0.0
        tas_mps = None

    spd = Speed(
        ias_mps=cockpit.ias_mps,
        tas_mps=tas_mps,
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
        hdg_rad=hdg_rad,
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
        self.udp_position_state: UdpPositionState = UdpPositionState()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def has_data(self) -> bool:
        """True if at least one stream has ever received data."""
        return (
            self.grpc_state.last_update != 0.0
            or self.cockpit_state.last_update != 0.0
            or self.udp_position_state.last_update != 0.0
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
        return merge(self.grpc_state, self.cockpit_state, self.udp_position_state)
