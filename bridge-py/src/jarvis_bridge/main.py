"""JARVIS Python Bridge — entry point.

Wires all components (gRPC client, UDP listener, normalizer, publisher,
heartbeat, TUI) into a single asyncio application.

CLI interface matches the Node.js bridge (packages/bridge/src/index.ts):
  jarvis-bridge                      # dev channel (session:dev)
  jarvis-bridge --channel session:X  # direct channel mode
  jarvis-bridge --code ABC123        # pairing code mode
"""
from __future__ import annotations

import argparse
import asyncio
import logging
import os
import signal
import webbrowser

from dotenv import load_dotenv

from jarvis_bridge.grpc_client import GrpcClient
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

# Web dashboard URL — local dev if env flag set, else production
_WEB_URL_PROD = "https://jarvis-dcs.vercel.app"
_WEB_URL_LOCAL = "http://localhost:3000"

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

async def _run(channel_topic: str, supabase_url: str, api_key: str) -> None:
    """Run all bridge components concurrently."""

    # --- Component construction ---
    grpc_client = GrpcClient()
    udp_listener = UdpListener()
    normalizer = Normalizer()
    publisher = SupabasePublisher(
        supabase_url=supabase_url,
        api_key=api_key,
        channel_topic=channel_topic,
    )

    retry_count = 0  # mutable via closure

    def _get_retry_count() -> int:
        return retry_count

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
        get_retry_count=_get_retry_count,
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
            normalizer.grpc_state = grpc_client.state
            normalizer.cockpit_state = udp_listener.state
            await asyncio.sleep(0.05)

    # --- gRPC reconnect loop (forever, exponential backoff) ---
    async def _grpc_loop() -> None:
        nonlocal retry_count
        backoff = 1.0
        max_backoff = 30.0
        while True:
            try:
                await grpc_client.run()
                # run() returned normally (stream ended) — reset backoff
                backoff = 1.0
                retry_count = 0
            except asyncio.CancelledError:
                raise
            except Exception as exc:  # noqa: BLE001
                log.debug("gRPC loop error: %s", exc)
            retry_count += 1
            log.debug("gRPC: reconnecting in %.1fs (attempt %d)", backoff, retry_count)
            await asyncio.sleep(backoff)
            backoff = min(backoff * 2, max_backoff)

    # --- 4 Hz publish loop ---
    async def _publish_loop() -> None:
        interval = 1.0 / 4
        while True:
            packet = normalizer.get_packet()
            if packet is not None:
                await publisher.publish_telemetry(packet)
            await asyncio.sleep(interval)

    # --- Gather all tasks ---
    tasks = [
        asyncio.create_task(_grpc_loop(), name="grpc_loop"),
        asyncio.create_task(_publish_loop(), name="publish_loop"),
        asyncio.create_task(_sync_normalizer(), name="sync_normalizer"),
        asyncio.create_task(tui.run(), name="tui"),
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

    # --- Logging setup ---
    logging.basicConfig(
        level=logging.WARNING,
        format="%(asctime)s %(levelname)s %(name)s: %(message)s",
        datefmt="%H:%M:%S",
    )
    # Suppress noisy gRPC logs
    logging.getLogger("grpc").setLevel(logging.ERROR)

    # --- CLI args ---
    parser = argparse.ArgumentParser(
        prog="jarvis-bridge",
        description="JARVIS Python Bridge — DCS gRPC + UDP → Supabase",
    )
    parser.add_argument(
        "--channel",
        metavar="CHANNEL",
        help='Direct channel (e.g. "session:dev")',
    )
    parser.add_argument(
        "--code",
        metavar="CODE",
        help="6-char pairing code (e.g. ABC123)",
    )
    args = parser.parse_args()

    # --- Credential resolution ---
    supabase_url, api_key = _resolve_credentials()
    using_defaults = supabase_url == _DEFAULT_SUPABASE_URL

    print(f"[BRIDGE] Supabase URL: {supabase_url}")
    print(f"[BRIDGE] Credentials: {'embedded defaults (anon key)' if using_defaults else 'from environment'}")

    # --- Channel resolution ---
    if args.channel:
        channel_topic = args.channel
        print(f"[BRIDGE] Dev mode — using channel: {channel_topic}")
    elif args.code:
        # POST /api/bridge/claim to exchange code → channel
        # For now, construct channel name directly (same fallback as Node.js bridge)
        channel_topic = f"session:{args.code}"
        print(f"[BRIDGE] Pairing code: {args.code} → channel: {channel_topic}")
    else:
        channel_topic = "session:dev"
        print("[BRIDGE] No --channel or --code provided, using dev channel: session:dev")

    # --- Auto-open browser ---
    web_url = _WEB_URL_LOCAL if os.environ.get("JARVIS_LOCAL_DEV") else _WEB_URL_PROD
    print(f"[BRIDGE] Opening browser: {web_url}")
    webbrowser.open(web_url)

    print(f"[BRIDGE] Starting bridge on channel: {channel_topic}")
    print("[BRIDGE] Press Ctrl+C to stop\n")

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
