"""Supabase Realtime command listener.

Subscribes to the session channel and listens for 'dcs_command' broadcast
events from the trainer web UI. Dispatches each command to CommandExecutor
and broadcasts the result back as 'dcs_command_result'.
"""
from __future__ import annotations

import asyncio
import logging
from typing import Any, Optional

from supabase import create_async_client

from jarvis_bridge.command_executor import CommandExecutor

log = logging.getLogger(__name__)


class CommandListener:
    """Subscribes to Supabase Realtime broadcast for inbound DCS commands.

    Listens for 'dcs_command' events on the session channel and dispatches
    to the CommandExecutor. Results are broadcast back as 'dcs_command_result'.
    """

    def __init__(
        self,
        supabase_url: str,
        api_key: str,
        channel_topic: str,
        executor: CommandExecutor,
    ) -> None:
        self._supabase_url = supabase_url
        self._api_key = api_key
        self._channel_topic = channel_topic
        self._executor = executor

        self._client: Any = None
        self._channel: Any = None
        self._running = False

    # ------------------------------------------------------------------
    # Lifecycle
    # ------------------------------------------------------------------

    async def start(self) -> None:
        """Connect to Supabase Realtime and subscribe to dcs_command events.

        Blocks until the channel is unsubscribed or an error occurs.
        Callers should run this in a reconnect loop.
        """
        self._running = True
        try:
            log.debug("CommandListener: connecting to %s on %s", self._channel_topic, self._supabase_url)

            self._client = await create_async_client(self._supabase_url, self._api_key)

            self._channel = (
                self._client.channel(self._channel_topic)
                .on_broadcast(event="dcs_command", callback=self._on_command)
            )

            await self._channel.subscribe()

            log.debug("CommandListener: subscribed to %s", self._channel_topic)

            # Keep alive — the WebSocket is maintained by the realtime client.
            # We poll until stop() is called or an error terminates us.
            while self._running:
                await asyncio.sleep(1.0)

        finally:
            await self._cleanup()

    async def stop(self) -> None:
        """Signal the listener to stop and clean up."""
        self._running = False
        await self._cleanup()

    async def _cleanup(self) -> None:
        """Unsubscribe channel and close Supabase client."""
        try:
            if self._channel is not None:
                await self._channel.unsubscribe()
                self._channel = None
        except Exception as exc:  # noqa: BLE001
            log.debug("CommandListener cleanup channel error: %s", exc)
        try:
            if self._client is not None:
                # AsyncClient does not always expose explicit close; best-effort
                close_fn = getattr(self._client, "aclose", None) or getattr(self._client, "close", None)
                if close_fn and asyncio.iscoroutinefunction(close_fn):
                    await close_fn()
                self._client = None
        except Exception as exc:  # noqa: BLE001
            log.debug("CommandListener cleanup client error: %s", exc)

    # ------------------------------------------------------------------
    # Broadcast callback
    # ------------------------------------------------------------------

    def _on_command(self, payload: dict[str, Any]) -> None:
        """Broadcast callback — fires on each dcs_command event.

        Creates an asyncio task to execute and respond asynchronously.
        The payload envelope from supabase-py looks like:
          {'type': 'broadcast', 'event': 'dcs_command', 'payload': {...}}
        """
        # Supabase broadcast wraps the user payload under 'payload'
        inner = payload.get("payload", payload)

        cmd_id: str = inner.get("id", "unknown")
        action: str = inner.get("action", "")
        cmd_payload: dict = inner.get("payload", {})

        log.debug("CommandListener: received dcs_command id=%s action=%s", cmd_id, action)

        asyncio.create_task(
            self._execute_and_respond(cmd_id, action, cmd_payload),
            name=f"cmd_{cmd_id[:8]}",
        )

    async def _execute_and_respond(
        self,
        cmd_id: str,
        action: str,
        payload: dict[str, Any],
    ) -> None:
        """Execute the command and broadcast the result back."""
        try:
            success, message = await self._executor.execute(action, payload)
        except Exception as exc:  # noqa: BLE001
            log.debug("CommandListener executor error: %s", exc)
            success = False
            message = str(exc)

        try:
            if self._channel is not None:
                await self._channel.send_broadcast(
                    event="dcs_command_result",
                    data={
                        "type": "dcs_command_result",
                        "id": cmd_id,
                        "success": success,
                        "message": message,
                    },
                )
                log.debug(
                    "CommandListener: result sent id=%s success=%s msg=%s",
                    cmd_id, success, message,
                )
        except Exception as exc:  # noqa: BLE001
            log.debug("CommandListener: failed to send result for %s: %s", cmd_id, exc)
