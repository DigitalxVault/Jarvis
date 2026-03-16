"""Rich Live TUI for the JARVIS Python bridge.

Displays live-updating stats: gRPC status, UDP packets,
Supabase publishes/errors/buffer, heartbeat, channel, Hz, uptime.
"""
from __future__ import annotations

import asyncio
import time
from typing import TYPE_CHECKING

from rich.console import Console
from rich.layout import Layout
from rich.live import Live
from rich.panel import Panel
from rich.table import Table
from rich.text import Text

if TYPE_CHECKING:
    from jarvis_bridge.grpc_client import GrpcClient
    from jarvis_bridge.heartbeat import Heartbeat
    from jarvis_bridge.publisher import SupabasePublisher
    from jarvis_bridge.udp_listener import UdpListener

_REFRESH_HZ = 4


def _grpc_status_text(connected: bool, ever_connected: bool) -> Text:
    if connected:
        return Text("Connected", style="bold green")
    if ever_connected:
        return Text("Reconnecting...", style="bold yellow")
    return Text("Waiting for DCS...", style="dim")


def _supabase_status_text(is_backing_off: bool) -> Text:
    if is_backing_off:
        return Text("Backing off", style="bold yellow")
    return Text("Connected", style="bold green")


def _build_table(
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
) -> Table:
    """Build the stats table displayed inside the TUI panel."""
    t = Table.grid(padding=(0, 2))
    t.add_column(style="cyan", no_wrap=True)
    t.add_column(no_wrap=True)

    mins, secs = divmod(int(uptime_s), 60)
    hrs, mins = divmod(mins, 60)
    uptime_str = f"{hrs:02d}:{mins:02d}:{secs:02d}"

    grpc_text = _grpc_status_text(grpc_connected, grpc_ever_connected)
    supabase_text = _supabase_status_text(is_backing_off)

    t.add_row("Channel", Text(channel, style="bold white"))
    t.add_row("Uptime", uptime_str)
    t.add_row("", "")
    t.add_row("DCS-gRPC", grpc_text)
    t.add_row("UDP Export", Text(f"{udp_packets} packets received", style="green" if udp_packets > 0 else "dim"))
    t.add_row("", "")
    t.add_row("Supabase", supabase_text)
    t.add_row("  published", str(published))
    t.add_row("  errors", Text(str(errors), style="red" if errors > 0 else "dim"))
    t.add_row("  buffer", Text(str(buffer_size), style="yellow" if buffer_size > 0 else "dim"))
    t.add_row("", "")
    t.add_row("Publish rate", "4 Hz")

    return t


class BridgeTUI:
    """Rich Live TUI that shows bridge status while it runs.

    Usage::

        tui = BridgeTUI(channel="session:dev", grpc_client=..., ...)
        asyncio.create_task(tui.run())
    """

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
        self._console = Console()

    def _render(self) -> Panel:
        uptime = time.monotonic() - self._start_time
        table = _build_table(
            channel=self._channel,
            uptime_s=uptime,
            grpc_connected=self._grpc.connected,
            grpc_ever_connected=self._grpc.ever_connected,
            udp_packets=self._udp.packet_count,
            published=self._publisher.total_published,
            errors=self._publisher.total_errors,
            buffer_size=self._publisher.buffer_size,
            is_backing_off=self._publisher.is_backing_off,
        )
        return Panel(
            table,
            title=Text(" JARVIS Bridge ", style="bold cyan"),
            subtitle=Text(" Ctrl+C to stop ", style="dim"),
            border_style="cyan",
            padding=(1, 2),
        )

    async def run(self) -> None:
        """Refresh the TUI panel at _REFRESH_HZ until cancelled."""
        with Live(
            self._render(),
            console=self._console,
            refresh_per_second=_REFRESH_HZ,
            screen=False,
        ) as live:
            try:
                while True:
                    live.update(self._render())
                    await asyncio.sleep(1.0 / _REFRESH_HZ)
            except asyncio.CancelledError:
                pass
