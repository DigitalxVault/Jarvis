"""Heartbeat broadcaster — publishes bridge status at 1 Hz.

Matches the heartbeat format sent by the Node.js bridge
(packages/bridge/src/publisher.ts publishHeartbeat).
"""
from __future__ import annotations

import asyncio
import logging
from typing import Callable

from jarvis_bridge.models import HeartbeatPacket
from jarvis_bridge.publisher import SupabasePublisher

logger = logging.getLogger(__name__)


class Heartbeat:
    """Broadcasts a HeartbeatPacket every second via SupabasePublisher.

    The heartbeat tells the web dashboard whether the bridge is alive and
    whether DCS is actively sending telemetry.  Its payload is identical in
    shape to what the Node.js bridge sends so the existing ``useTelemetry``
    hook processes it unchanged.

    Usage::

        hb = Heartbeat(
            publisher=publisher,
            get_dcs_active=lambda: udp_listener.is_active,
            get_packet_count=lambda: udp_listener.packet_count,
            get_queue_size=lambda: queue.size,
        )
        await hb.start()
        # ... run ...
        hb.stop()
    """

    _INTERVAL_S: float = 1.0

    def __init__(
        self,
        publisher: SupabasePublisher,
        get_dcs_active: Callable[[], bool],
        get_packet_count: Callable[[], int],
        get_queue_size: Callable[[], int],
    ) -> None:
        self._publisher = publisher
        self._get_dcs_active = get_dcs_active
        self._get_packet_count = get_packet_count
        self._get_queue_size = get_queue_size

        self._running: bool = False
        self._task: asyncio.Task[None] | None = None

    async def start(self) -> None:
        """Start the heartbeat loop as a background asyncio task."""
        self._running = True
        self._task = asyncio.create_task(self._loop(), name="heartbeat")

    def stop(self) -> None:
        """Cancel the heartbeat task."""
        self._running = False
        if self._task is not None and not self._task.done():
            self._task.cancel()
            self._task = None

    async def _loop(self) -> None:
        """Internal loop: broadcast heartbeat every second."""
        while self._running:
            try:
                packet = HeartbeatPacket(
                    type="heartbeat",
                    dcsActive=self._get_dcs_active(),
                    packetCount=self._get_packet_count(),
                    queueSize=self._get_queue_size(),
                )
                await self._publisher.broadcast("heartbeat", packet.model_dump())
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                # Heartbeat is non-critical; swallow errors to keep loop alive
                logger.debug("Heartbeat broadcast error (ignored): %s", exc)

            await asyncio.sleep(self._INTERVAL_S)
