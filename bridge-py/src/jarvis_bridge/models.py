"""Pydantic models mirroring the TypeScript types in packages/shared/src/types.ts.

All field names EXACTLY match the TypeScript interface fields.
All float fields use `float` type. SI units throughout.
"""
from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel


class Position(BaseModel):
    """Corresponds to TelemetryPacket.pos"""
    lat: float
    lon: float
    alt_m: float
    alt_agl_m: Optional[float] = None


class Attitude(BaseModel):
    """Corresponds to TelemetryPacket.att"""
    pitch_rad: float
    bank_rad: float
    yaw_rad: float


class GForce(BaseModel):
    """Corresponds to TelemetryPacket.aero.g"""
    x: float
    y: float
    z: float


class AngularVelocity(BaseModel):
    """Corresponds to TelemetryPacket.aero.ang_vel"""
    x: float
    y: float
    z: float


class Aero(BaseModel):
    """Corresponds to TelemetryPacket.aero"""
    aoa_rad: float
    g: GForce
    ang_vel: AngularVelocity


class Speed(BaseModel):
    """Corresponds to TelemetryPacket.spd"""
    ias_mps: float
    tas_mps: Optional[float] = None
    vvi_mps: Optional[float] = None
    mach: float


class Fuel(BaseModel):
    """Corresponds to TelemetryPacket.fuel"""
    internal: float
    external: float


class Engine(BaseModel):
    """Corresponds to TelemetryPacket.eng"""
    rpm_pct: float
    fuel_con: float


class TelemetryPacket(BaseModel):
    """Mirrors the TypeScript TelemetryPacket interface exactly."""
    type: Literal["telemetry"]
    t_model: float
    pos: Position
    att: Attitude
    spd: Speed
    hdg_rad: float
    aero: Optional[Aero] = None
    fuel: Optional[Fuel] = None
    eng: Optional[Engine] = None


class HeartbeatPacket(BaseModel):
    """Mirrors the TypeScript HeartbeatPacket interface exactly.

    Note: camelCase field names match the TypeScript interface.
    """
    type: Literal["heartbeat"]
    dcsActive: bool
    packetCount: int
    queueSize: int
