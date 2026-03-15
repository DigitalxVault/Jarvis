"""Supabase REST broadcast publisher with exponential backoff and packet buffer.

Matches the exact broadcast format used by the Node.js bridge
(packages/bridge/src/publisher.ts).
"""
from __future__ import annotations

import time
from collections import deque
from typing import Any

import httpx

from jarvis_bridge.models import TelemetryPacket


class SupabasePublisher:
    """Broadcasts telemetry and heartbeat events via Supabase REST broadcast.

    Implements the same /realtime/v1/api/broadcast endpoint and message
    envelope used by the Node.js bridge so the web dashboard receives
    identical payloads regardless of which bridge is running.

    Backoff strategy: on any HTTP or network error the publisher enters a
    back-off window (starting at 1 s, doubling up to 30 s).  During back-off,
    incoming telemetry packets are stored in a bounded deque (maxlen=40,
    ≈10 s at 4 Hz).  Once the back-off window expires, buffered packets are
    flushed (most-recent first) before the live packet is sent.
    """

    _MAX_BACKOFF_S: float = 30.0
    _BASE_BACKOFF_S: float = 1.0

    def __init__(
        self,
        supabase_url: str,
        api_key: str,
        channel_topic: str,
    ) -> None:
        self._supabase_url = supabase_url.rstrip("/")
        self._api_key = api_key
        self._channel_topic = channel_topic

        self._client = httpx.AsyncClient(timeout=5.0)

        # Backoff state
        self._backoff_s: float = self._BASE_BACKOFF_S
        self._backoff_until: float = 0.0  # monotonic timestamp

        # Buffer: bounded deque, drop-oldest on overflow
        self._buffer: deque[dict[str, Any]] = deque(maxlen=40)

        # Metrics
        self._total_published: int = 0
        self._total_errors: int = 0

    # ------------------------------------------------------------------
    # Core broadcast — mirrors Node.js publisher.broadcast()
    # ------------------------------------------------------------------

    async def broadcast(self, event: str, payload: dict[str, Any]) -> None:
        """POST a single event to Supabase realtime broadcast.

        Raises:
            httpx.HTTPError: on network or HTTP errors (caller handles).
        """
        url = f"{self._supabase_url}/realtime/v1/api/broadcast"
        body = {
            "messages": [
                {
                    "topic": self._channel_topic,
                    "event": event,
                    "payload": payload,
                }
            ]
        }
        response = await self._client.post(
            url,
            json=body,
            headers={
                "apikey": self._api_key,
                "Content-Type": "application/json",
            },
        )
        if not response.is_success:
            raise httpx.HTTPStatusError(
                f"HTTP {response.status_code}: {response.text}",
                request=response.request,
                response=response,
            )

    # ------------------------------------------------------------------
    # Buffer management
    # ------------------------------------------------------------------

    async def _flush_buffer(self) -> None:
        """Send buffered packets oldest-first, stopping on first error."""
        while self._buffer:
            packet_dict = self._buffer.popleft()
            try:
                await self.broadcast("telemetry", packet_dict)
                self._total_published += 1
            except Exception:
                # Re-buffer this packet and re-enter back-off
                self._buffer.appendleft(packet_dict)
                self._total_errors += 1
                self._backoff_until = time.monotonic() + self._backoff_s
                self._backoff_s = min(self._backoff_s * 2, self._MAX_BACKOFF_S)
                return  # Stop flushing

    # ------------------------------------------------------------------
    # Public telemetry publish
    # ------------------------------------------------------------------

    async def publish_telemetry(self, packet: TelemetryPacket) -> None:
        """Publish a telemetry packet, buffering during back-off windows.

        If the publisher is currently in a back-off window the packet is
        added to the buffer and the method returns immediately.  When the
        back-off window has expired, buffered packets are flushed first,
        then the current packet is sent.
        """
        now = time.monotonic()

        # During back-off: buffer and return immediately
        if now < self._backoff_until:
            self._buffer.append(packet.model_dump())
            return

        # Back-off window has expired — flush buffered packets first
        if self._buffer:
            await self._flush_buffer()
            # If flush re-entered back-off, buffer this packet too
            if time.monotonic() < self._backoff_until:
                self._buffer.append(packet.model_dump())
                return

        # Send the live packet
        try:
            await self.broadcast("telemetry", packet.model_dump())
            self._total_published += 1
            # Success — reset backoff
            self._backoff_s = self._BASE_BACKOFF_S
        except Exception:
            self._total_errors += 1
            self._buffer.append(packet.model_dump())
            self._backoff_until = time.monotonic() + self._backoff_s
            self._backoff_s = min(self._backoff_s * 2, self._MAX_BACKOFF_S)

    # ------------------------------------------------------------------
    # Health check
    # ------------------------------------------------------------------

    async def health_check(self) -> bool:
        """Return True if Supabase REST endpoint is reachable."""
        try:
            response = await self._client.get(
                f"{self._supabase_url}/rest/v1/",
                headers={"apikey": self._api_key},
                timeout=5.0,
            )
            return response.is_success
        except Exception:
            return False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def close(self) -> None:
        """Close the underlying HTTP client."""
        await self._client.aclose()

    # ------------------------------------------------------------------
    # Properties
    # ------------------------------------------------------------------

    @property
    def total_published(self) -> int:
        return self._total_published

    @property
    def total_errors(self) -> int:
        return self._total_errors

    @property
    def buffer_size(self) -> int:
        return len(self._buffer)

    @property
    def is_backing_off(self) -> bool:
        return time.monotonic() < self._backoff_until
