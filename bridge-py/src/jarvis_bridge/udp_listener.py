"""Asyncio UDP listener for DCS cockpit telemetry packets (port 7779).

Receives JSON datagrams from jarvis_export.lua, parses packets of
type "cockpit", and stores the latest state in a CockpitState dataclass.
"""
from __future__ import annotations

import asyncio
import json
import logging
import time
from dataclasses import dataclass, field

log = logging.getLogger(__name__)

UDP_PORT: int = 7779


@dataclass
class CockpitState:
    """Latest cockpit sensor data received over UDP from DCS Lua."""

    ias_mps: float = 0.0
    mach: float = 0.0
    vvi_mps: float = 0.0
    alt_agl_m: float = 0.0
    fuel_internal: float = 0.0
    fuel_external: float = 0.0
    rpm_pct: float = 0.0
    fuel_con: float = 0.0
    aoa_rad: float = 0.0
    g_x: float = 0.0
    g_y: float = 1.0
    g_z: float = 0.0
    ang_vel_x: float = 0.0
    ang_vel_y: float = 0.0
    ang_vel_z: float = 0.0
    t_model: float = 0.0
    last_update: float = field(default_factory=float)


class _UdpProtocol(asyncio.DatagramProtocol):
    """Internal asyncio protocol that feeds the UdpListener."""

    def __init__(self, listener: UdpListener) -> None:
        self._listener = listener

    def datagram_received(self, data: bytes, addr: tuple[str, int]) -> None:
        self._listener._on_datagram(data)

    def error_received(self, exc: Exception) -> None:  # noqa: D102
        log.warning("UDP: transport error — %s", exc)

    def connection_lost(self, exc: Exception | None) -> None:  # noqa: D102
        if exc:
            log.error("UDP: connection lost — %s", exc)
        else:
            log.info("UDP: transport closed")


class UdpListener:
    """Asyncio UDP receiver that parses cockpit telemetry datagrams.

    Usage::

        listener = UdpListener()
        await listener.start()
        # later: listener.state.ias_mps, listener.packet_count
    """

    def __init__(self, port: int = UDP_PORT) -> None:
        self._port = port
        self.state: CockpitState = CockpitState()
        self.packet_count: int = 0
        self._transport: asyncio.BaseTransport | None = None
        self._first_packet_logged: bool = False

    async def start(self) -> None:
        """Bind UDP socket and begin receiving datagrams."""
        loop = asyncio.get_running_loop()
        self._transport, _ = await loop.create_datagram_endpoint(
            lambda: _UdpProtocol(self),
            local_addr=("0.0.0.0", self._port),
        )
        log.info("UDP: listening on port %d", self._port)

    def stop(self) -> None:
        """Close the UDP transport."""
        if self._transport is not None:
            self._transport.close()
            self._transport = None
            log.info("UDP: transport stopped")

    # ------------------------------------------------------------------
    # Internal helpers
    # ------------------------------------------------------------------

    def _on_datagram(self, data: bytes) -> None:
        """Parse a raw UDP datagram and update CockpitState."""
        try:
            packet = json.loads(data)
        except (json.JSONDecodeError, UnicodeDecodeError) as exc:
            log.debug("UDP: malformed datagram — %s", exc)
            return

        if packet.get("type") != "cockpit":
            return

        if not self._first_packet_logged:
            log.info("UDP: first cockpit packet received")
            self._first_packet_logged = True

        self.packet_count += 1
        self.state = CockpitState(
            ias_mps=float(packet.get("ias_mps", 0.0)),
            mach=float(packet.get("mach", 0.0)),
            vvi_mps=float(packet.get("vvi_mps", 0.0)),
            alt_agl_m=float(packet.get("alt_agl_m", 0.0)),
            fuel_internal=float(packet.get("fuel_internal", 0.0)),
            fuel_external=float(packet.get("fuel_external", 0.0)),
            rpm_pct=float(packet.get("rpm_pct", 0.0)),
            fuel_con=float(packet.get("fuel_con", 0.0)),
            aoa_rad=float(packet.get("aoa_rad", 0.0)),
            g_x=float(packet.get("g_x", 0.0)),
            g_y=float(packet.get("g_y", 1.0)),
            g_z=float(packet.get("g_z", 0.0)),
            ang_vel_x=float(packet.get("ang_vel_x", 0.0)),
            ang_vel_y=float(packet.get("ang_vel_y", 0.0)),
            ang_vel_z=float(packet.get("ang_vel_z", 0.0)),
            t_model=float(packet.get("t_model", 0.0)),
            last_update=time.monotonic(),
        )
