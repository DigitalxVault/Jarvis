"""JARVIS Python Bridge — entry point.

Wires all components (gRPC client, UDP listener, normalizer, publisher,
heartbeat, TUI) into a single asyncio application.

CLI interface:
  jarvis-bridge                      # default: session:dev
  jarvis-bridge --channel session:X  # direct channel override
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import random
import signal

from dotenv import load_dotenv

from jarvis_bridge.heartbeat import Heartbeat
from jarvis_bridge.normalizer import Normalizer
from jarvis_bridge.publisher import SupabasePublisher
from jarvis_bridge.tui import BridgeTUI
from jarvis_bridge.udp_listener import UdpListener

# ---------------------------------------------------------------------------
# Embedded defaults (anon key is public — safe to ship in source)
# ---------------------------------------------------------------------------
_DEFAULT_SUPABASE_URL = "https://cvqvxaiyuauprnceikkv.supabase.co"
_DEFAULT_SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXZ4YWl5dWF1cHJuY2Vpa2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTY2MTksImV4cCI6MjA4NzU3MjYxOX0."
    "G3rQI-x6cxAWEN9No8AWWyC_hBTj_vFRzm6QKyMX3sU"
)

log = logging.getLogger(__name__)


# ---------------------------------------------------------------------------
# Credential resolution
# ---------------------------------------------------------------------------

def _resolve_credentials() -> tuple[str, str]:
    """Return (supabase_url, api_key) from env or embedded defaults."""
    url = (
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or os.environ.get("SUPABASE_URL")
        or _DEFAULT_SUPABASE_URL
    )
    key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or _DEFAULT_SUPABASE_KEY
    )
    return url, key


# ---------------------------------------------------------------------------
# Async application
# ---------------------------------------------------------------------------

async def _run(channel_topic: str, supabase_url: str, api_key: str, start_code: str) -> None:
    """Run all bridge components concurrently."""

    # --- Component construction ---
    # Lazy imports: gRPC modules depend on generated proto stubs
    # (bridge-py/generated/) which may not exist on fresh clones.
    # The bridge still runs for telemetry (UDP only) without them.
    grpc_client = None
    command_executor = None
    command_listener = None
    try:
        from jarvis_bridge.grpc_client import GrpcClient
        from jarvis_bridge.command_executor import CommandExecutor
        from jarvis_bridge.command_listener import CommandListener

        grpc_target = os.environ.get("DCS_GRPC_HOST", "localhost:50051")
        grpc_client = GrpcClient(target=grpc_target)
        command_executor = CommandExecutor(target=grpc_target)
        command_listener = CommandListener(
            supabase_url=supabase_url,
            api_key=api_key,
            channel_topic=channel_topic,
            executor=command_executor,
        )
    except ImportError:
        log.warning("gRPC stubs not found — DCS-gRPC + command execution disabled. Run scripts/gen_stubs.sh to enable.")
    udp_listener = UdpListener()
    normalizer = Normalizer()
    publisher = SupabasePublisher(
        supabase_url=supabase_url,
        api_key=api_key,
        channel_topic=channel_topic,
    )

    heartbeat = Heartbeat(
        publisher=publisher,
        get_dcs_active=lambda: normalizer.dcs_active,
        get_packet_count=lambda: udp_listener.packet_count,
        get_queue_size=lambda: publisher.buffer_size,
    )
    tui = BridgeTUI(
        channel=channel_topic,
        grpc_client=grpc_client,
        udp_listener=udp_listener,
        publisher=publisher,
        start_code=start_code,
    )

    # --- Supabase health check ---
    healthy = await publisher.health_check()
    log.info("Supabase health check: %s", "OK" if healthy else "FAILED (will retry on publish)")

    # --- Start UDP listener ---
    await udp_listener.start()

    # --- Start heartbeat ---
    await heartbeat.start()

    # --- Wire normalizer: keep grpc_state and cockpit_state in sync ---
    # The normalizer holds references to shared state objects. We update its
    # references after each gRPC / UDP tick via a sync wrapper.
    async def _sync_normalizer() -> None:
        """Copy live state objects into the normalizer every 50 ms."""
        while True:
            if grpc_client is not None:
                normalizer.grpc_state = grpc_client.state
            normalizer.cockpit_state = udp_listener.state
            normalizer.udp_position_state = udp_listener.position_state
            await asyncio.sleep(0.05)

    # --- gRPC reconnect loop (forever, exponential backoff) ---
    async def _grpc_loop() -> None:
        if grpc_client is None:
            return  # gRPC stubs not available
        backoff = 1.0
        max_backoff = 30.0
        while True:
            try:
                await grpc_client.run()
                # run() returned normally (stream ended) — reset backoff
                backoff = 1.0
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.debug("gRPC loop error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

    # --- 4 Hz publish loop ---
    async def _publish_loop() -> None:
        interval = 1.0 / 4
        last_tactical = None
        while True:
            packet = normalizer.get_packet()
            if packet is not None:
                await publisher.publish_telemetry(packet)

            # Forward tactical packets from Lua (~1 Hz)
            tac = udp_listener.latest_tactical
            if tac is not None and tac is not last_tactical:
                last_tactical = tac
                await publisher.publish_raw("tactical", tac)

            await asyncio.sleep(interval)

    # --- Command listener reconnect loop ---
    async def _command_loop() -> None:
        """Command listener with exponential backoff reconnect."""
        if command_listener is None:
            return  # gRPC stubs not available
        backoff = 1.0
        max_backoff = 30.0
        while True:
            try:
                await command_listener.start()
                # start() returned normally (e.g. after stop()) — done
                break
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.debug("Command listener error: %s", exc)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

    # --- Start code broadcast loop (every 5s so late-joining browsers pick it up) ---
    async def _start_code_loop() -> None:
        while True:
            await publisher.broadcast_start_code(start_code)
            await asyncio.sleep(5)

    # --- Gather all tasks ---
    tasks = [
        asyncio.create_task(_grpc_loop(), name="grpc_loop"),
        asyncio.create_task(_publish_loop(), name="publish_loop"),
        asyncio.create_task(_sync_normalizer(), name="sync_normalizer"),
        asyncio.create_task(tui.run(), name="tui"),
        asyncio.create_task(_command_loop(), name="command_loop"),
        asyncio.create_task(_start_code_loop(), name="start_code_loop"),
    ]

    try:
        await asyncio.gather(*tasks)
    except asyncio.CancelledError:
        pass
    finally:
        for task in tasks:
            if not task.done():
                task.cancel()
        # Give tasks a moment to cancel
        await asyncio.gather(*tasks, return_exceptions=True)
        heartbeat.stop()
        udp_listener.stop()
        await publisher.close()
        if command_listener is not None:
            await command_listener.stop()
        if command_executor is not None:
            await command_executor.close()
        log.info("Bridge shutdown complete.")


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

def main() -> None:
    """CLI entry point — called by `jarvis-bridge` console script."""
    # Load .env from bridge-py/ directory (next to pyproject.toml)
    _dotenv_path = os.path.join(os.path.dirname(__file__), "..", "..", "..", ".env")
    load_dotenv(_dotenv_path, override=False)
    # Also try the current working directory
    load_dotenv(override=False)

    # --- Logging setup (suppress all — TUI is the user interface) ---
    logging.basicConfig(
        level=logging.CRITICAL,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )

    # --- CLI args ---
    parser = argparse.ArgumentParser(
        prog="jarvis-bridge",
        description="JARVIS Python Bridge — DCS gRPC + UDP → Supabase",
    )
    parser.add_argument(
        "--channel",
        metavar="CHANNEL",
        help='Channel override (default: "session:dev")',
    )
    args = parser.parse_args()

    # --- Credential resolution ---
    supabase_url, api_key = _resolve_credentials()

    # --- Channel resolution ---
    channel_topic = args.channel or "session:dev"

    # --- Generate 4-digit START CODE (displayed in TUI, entered on web) ---
    start_code = str(random.randint(1000, 9999))

    # --- Run asyncio event loop ---
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    # Register shutdown signals
    def _handle_shutdown(sig: signal.Signals) -> None:
        print(f"\n[BRIDGE] Received {sig.name}, shutting down...")
        for task in asyncio.all_tasks(loop):
            task.cancel()

    for sig in (signal.SIGINT, signal.SIGTERM):
        try:
            loop.add_signal_handler(sig, lambda s=sig: _handle_shutdown(s))
        except (NotImplementedError, RuntimeError):
            # Windows doesn't support add_signal_handler on non-main thread
            pass

    try:
        loop.run_until_complete(
            _run(
                channel_topic=channel_topic,
                supabase_url=supabase_url,
                api_key=api_key,
                start_code=start_code,
            )
        )
    except (KeyboardInterrupt, asyncio.CancelledError):
        pass
    finally:
        # Cancel any remaining tasks
        pending = asyncio.all_tasks(loop)
        if pending:
            for task in pending:
                task.cancel()
            loop.run_until_complete(asyncio.gather(*pending, return_exceptions=True))
        loop.close()
        print("[BRIDGE] Goodbye.")


if __name__ == "__main__":
    main()
