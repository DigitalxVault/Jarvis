"""Simple terminal TUI for the JARVIS Python bridge.

Uses clear-and-reprint for maximum compatibility across
Windows PowerShell, cmd.exe, and macOS/Linux terminals.
"""
from __future__ import annotations

import asyncio
import os
import platform
import time
from typing import TYPE_CHECKING

from rich.console import Console
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

if TYPE_CHECKING:
    from jarvis_bridge.grpc_client import GrpcClient
    from jarvis_bridge.publisher import SupabasePublisher
    from jarvis_bridge.udp_listener import UdpListener

_REFRESH_HZ = 1  # 1 Hz is plenty — no flicker, calm display
_IS_WINDOWS = platform.system() == "Windows"


def _clear_screen() -> None:
    if _IS_WINDOWS:
        os.system("cls")
    else:
        os.system("clear")


def _grpc_status(connected: bool, ever_connected: bool) -> Text:
    if connected:
        return Text("Connected", style="bold green")
    if ever_connected:
        return Text("Reconnecting...", style="bold yellow")
    return Text("Waiting for DCS...", style="dim")


def _supabase_status(is_backing_off: bool) -> Text:
    if is_backing_off:
        return Text("Backing off", style="bold yellow")
    return Text("Connected", style="bold green")


def _build_panel(
    *,
    channel: str,
    uptime_s: float,
    grpc_connected: bool,
    grpc_ever_connected: bool,
    udp_packets: int,
    published: int,
    errors: int,
    buffer_size: int,
    is_backing_off: bool,
) -> Panel:
    t = Table.grid(padding=(0, 2))
    t.add_column(style="cyan", no_wrap=True)
    t.add_column(no_wrap=True)

    mins, secs = divmod(int(uptime_s), 60)
    hrs, mins = divmod(mins, 60)

    t.add_row("Channel", Text(channel, style="bold white"))
    t.add_row("Uptime", f"{hrs:02d}:{mins:02d}:{secs:02d}")
    t.add_row("", "")
    t.add_row("DCS-gRPC", _grpc_status(grpc_connected, grpc_ever_connected))
    t.add_row("UDP Export", Text(
        f"{udp_packets} packets received" if udp_packets > 0 else "Waiting for DCS...",
        style="green" if udp_packets > 0 else "dim",
    ))
    t.add_row("", "")
    t.add_row("Supabase", _supabase_status(is_backing_off))
    t.add_row("  published", str(published))
    t.add_row("  errors", Text(str(errors), style="red" if errors > 0 else "dim"))
    t.add_row("  buffer", Text(str(buffer_size), style="yellow" if buffer_size > 0 else "dim"))
    t.add_row("", "")
    t.add_row("Publish rate", "4 Hz")

    return Panel(
        t,
        title=Text(" JARVIS Bridge ", style="bold cyan"),
        subtitle=Text(" Ctrl+C to stop ", style="dim"),
        border_style="cyan",
        padding=(1, 2),
    )


class BridgeTUI:
    """Terminal UI that clears and reprints a status panel every second."""

    def __init__(
        self,
        *,
        channel: str,
        grpc_client: "GrpcClient",
        udp_listener: "UdpListener",
        publisher: "SupabasePublisher",
    ) -> None:
        self._channel = channel
        self._grpc = grpc_client
        self._udp = udp_listener
        self._publisher = publisher
        self._start_time = time.monotonic()
        self._console = Console(highlight=False)

    def _render(self) -> Panel:
        return _build_panel(
            channel=self._channel,
            uptime_s=time.monotonic() - self._start_time,
            grpc_connected=self._grpc.connected,
            grpc_ever_connected=self._grpc.ever_connected,
            udp_packets=self._udp.packet_count,
            published=self._publisher.total_published,
            errors=self._publisher.total_errors,
            buffer_size=self._publisher.buffer_size,
            is_backing_off=self._publisher.is_backing_off,
        )

    async def run(self) -> None:
        """Clear screen and reprint the panel every second."""
        try:
            while True:
                _clear_screen()
                self._console.print(self._render())
                await asyncio.sleep(1.0 / _REFRESH_HZ)
        except asyncio.CancelledError:
            pass
