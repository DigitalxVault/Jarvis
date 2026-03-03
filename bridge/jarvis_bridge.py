#!/usr/bin/env python3
"""
JARVIS DCS Bridge - Standalone Python Edition
Relays DCS telemetry + tactical data (UDP) to Supabase Realtime broadcast.

Zero dependencies - Python 3.8+ stdlib only.
Just run: python jarvis_bridge.py

Usage:
    python jarvis_bridge.py                      # Default: channel = session:dev
    python jarvis_bridge.py --channel session:x  # Direct channel
    python jarvis_bridge.py --code ABC123        # Pairing code -> session:ABC123
"""

from __future__ import annotations

import json
import os
import signal
import socket
import ssl
import sys
import threading
import time
from argparse import ArgumentParser
from collections import deque
from typing import Any, Dict, Optional
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

VERSION = "1.0.0"

# -- Constants (matching packages/shared/src/constants.ts) --------------------

UDP_PORT = 7779
PUBLISH_INTERVAL_S = 0.250        # 4 Hz (1000 / 4 = 250ms)
HEARTBEAT_INTERVAL_S = 1.0        # 1 Hz
TACTICAL_INTERVAL_S = 1.0         # 1 Hz (matches DCS send rate)
STALENESS_TIMEOUT_S = 3.0         # DCS considered silent after 3s
METRICS_LOG_INTERVAL_S = 5.0      # log metrics every 5s
MAX_QUEUE_SIZE = 100
BASE_BACKOFF_S = 1.0
MAX_BACKOFF_S = 30.0

# -- Default Supabase credentials (safe to embed - anon key is public) --------

DEFAULT_SUPABASE_URL = "https://cvqvxaiyuauprnceikkv.supabase.co"
DEFAULT_SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXZ4YWl5dWF1cHJuY2Vpa2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTY2MTksImV4cCI6MjA4NzU3MjYxOX0."
    "G3rQI-x6cxAWEN9No8AWWyC_hBTj_vFRzm6QKyMX3sU"
)
DEFAULT_CHANNEL = "session:dev"


# -- Bounded Queue ------------------------------------------------------------

class BoundedQueue:
    """Thread-safe bounded FIFO queue. Drops oldest items on overflow.
    LIFO drain: empties queue, returns only the latest packet."""

    def __init__(self, maxsize: int = MAX_QUEUE_SIZE):
        self._deque: deque = deque(maxlen=maxsize)
        self._lock = threading.Lock()

    def push(self, item: Any) -> None:
        with self._lock:
            self._deque.append(item)

    def drain_latest(self) -> Optional[Any]:
        """Take the latest item and discard all older ones."""
        with self._lock:
            if not self._deque:
                return None
            latest = self._deque[-1]
            self._deque.clear()
            return latest

    @property
    def size(self) -> int:
        with self._lock:
            return len(self._deque)


# -- Metrics ------------------------------------------------------------------

class Metrics:
    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.udp_received = 0
        self.published = 0
        self.errors = 0
        self.tactical_received = 0
        self.tactical_published = 0
        self._last_log_at = time.monotonic()
        self._was_dcs_active = True

    def record_udp(self) -> None:
        with self._lock:
            self.udp_received += 1

    def record_publish(self) -> None:
        with self._lock:
            self.published += 1

    def record_error(self) -> None:
        with self._lock:
            self.errors += 1

    def record_tactical_receive(self) -> None:
        with self._lock:
            self.tactical_received += 1

    def record_tactical_publish(self) -> None:
        with self._lock:
            self.tactical_published += 1

    def record_dcs_silent(self, dcs_active: bool) -> None:
        with self._lock:
            if not dcs_active and self._was_dcs_active:
                print("[BRIDGE] DCS_SILENT - no UDP packet for 3s")
            self._was_dcs_active = dcs_active

    def log_and_reset(self) -> None:
        with self._lock:
            elapsed = max(time.monotonic() - self._last_log_at, 0.001)
            rate = self.udp_received / elapsed
            print(
                f"[METRICS] udp={self.udp_received} pub={self.published} "
                f"err={self.errors} tac_rx={self.tactical_received} "
                f"tac_pub={self.tactical_published} rate={rate:.1f}/s"
            )
            self._last_log_at = time.monotonic()
            self.udp_received = 0
            self.published = 0
            self.errors = 0
            self.tactical_received = 0
            self.tactical_published = 0


# -- SSL Context --------------------------------------------------------------

def _make_ssl_context() -> ssl.SSLContext:
    """Create an SSL context that works across platforms."""
    ctx = ssl.create_default_context()
    try:
        ctx.load_default_certs()  # type: ignore[attr-defined]
    except (AttributeError, ssl.SSLError):
        pass
    return ctx


# -- Supabase Broadcaster -----------------------------------------------------

class SupabaseBroadcaster:
    def __init__(self, url: str, key: str, channel: str) -> None:
        self.endpoint = f"{url}/realtime/v1/api/broadcast"
        self.rest_endpoint = f"{url}/rest/v1/"
        self.key = key
        self.channel = channel
        self._ssl_ctx: Optional[ssl.SSLContext] = _make_ssl_context()
        self._ssl_warned = False

    def broadcast(self, event: str, payload: Any) -> None:
        """POST to Supabase broadcast endpoint. Raises on failure."""
        body = json.dumps({
            "messages": [{
                "topic": self.channel,
                "event": event,
                "payload": payload,
            }]
        }).encode("utf-8")

        req = Request(
            self.endpoint,
            data=body,
            headers={
                "apikey": self.key,
                "Content-Type": "application/json",
            },
            method="POST",
        )

        try:
            with urlopen(req, timeout=5, context=self._ssl_ctx) as resp:
                resp.read()
        except URLError as exc:
            if "CERTIFICATE_VERIFY_FAILED" in str(exc) and self._ssl_ctx:
                if not self._ssl_warned:
                    print(
                        "[SSL] Certificate verification failed - falling back "
                        "to unverified mode.\n"
                        "      On macOS, run: /Applications/Python 3.x/"
                        "Install Certificates.command"
                    )
                    self._ssl_warned = True
                self._ssl_ctx = ssl.create_default_context()
                self._ssl_ctx.check_hostname = False
                self._ssl_ctx.verify_mode = ssl.CERT_NONE
                with urlopen(req, timeout=5, context=self._ssl_ctx) as resp:
                    resp.read()
            else:
                raise

    def health_check(self) -> bool:
        """GET /rest/v1/ to verify Supabase is reachable. Non-critical."""
        req = Request(
            self.rest_endpoint,
            headers={"apikey": self.key},
            method="GET",
        )
        try:
            with urlopen(req, timeout=5, context=self._ssl_ctx) as resp:
                resp.read()
                print(f"[BRIDGE] Supabase reachable (HTTP {resp.status})")
                return True
        except Exception as exc:
            print(f"[BRIDGE] Supabase health check FAILED: {exc}")
            print(f"[BRIDGE]   URL used: {self.rest_endpoint}")
            print("[BRIDGE]   Check: network connectivity, DNS resolution, firewall rules")
            return False


# -- Bridge -------------------------------------------------------------------

class JarvisBridge:
    def __init__(self, supabase_url: str, supabase_key: str, channel: str) -> None:
        self.queue = BoundedQueue()
        self.metrics = Metrics()
        self.broadcaster = SupabaseBroadcaster(supabase_url, supabase_key, channel)
        self.channel = channel

        self._last_udp_at = 0.0         # monotonic time of last UDP packet
        self._backoff_s = BASE_BACKOFF_S
        self._backoff_until = 0.0       # monotonic time until which to skip publishes
        self._fetch_error_logged = False
        self._stop = threading.Event()

        # Tactical state
        self._tactical_lock = threading.Lock()
        self._latest_tactical: Optional[Dict] = None
        self._tactical_dirty = False

        # One-time raw dump diagnostic
        self._raw_dump_done = False

    # -- UDP listener (runs in its own thread) --------------------------------

    def _udp_loop(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(1.0)
        sock.bind(("0.0.0.0", UDP_PORT))
        print(f"[UDP] Listening on 0.0.0.0:{UDP_PORT}")

        while not self._stop.is_set():
            try:
                data, _addr = sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                break

            raw_str = data.decode("utf-8", errors="replace")

            # One-time: dump first non-telemetry packet raw (before JSON.parse)
            if not self._raw_dump_done and not raw_str.startswith('{"type":"telemetry"'):
                self._raw_dump_done = True
                print(f"[UDP] *** RAW NON-TELEMETRY ({len(data)} bytes) ***")
                print(f"[UDP] {raw_str[:500]}")

            try:
                pkt = json.loads(raw_str)
                pkt_type = pkt.get("type")

                if pkt_type == "telemetry":
                    self.metrics.record_udp()
                    self._last_udp_at = time.monotonic()
                    self.queue.push(pkt)

                elif pkt_type == "tactical":
                    obj_count = len(pkt.get("objects", []))
                    tgt_count = len(pkt.get("targets", []))
                    print(
                        f"[UDP] Tactical packet received "
                        f"(t={pkt.get('t_model', '?')}, "
                        f"objects={obj_count}, targets={tgt_count})"
                    )
                    self.metrics.record_tactical_receive()
                    self._last_udp_at = time.monotonic()
                    with self._tactical_lock:
                        self._latest_tactical = pkt
                        self._tactical_dirty = True

                else:
                    keys = ",".join(pkt.keys()) if isinstance(pkt, dict) else "?"
                    print(
                        f'[UDP] Unknown packet type="{pkt_type}" '
                        f"keys=[{keys}] size={len(data)}"
                    )

            except (json.JSONDecodeError, UnicodeDecodeError) as exc:
                print(f"[UDP] Parse FAILED: {exc}")
                print(f"[UDP] Raw: {raw_str[:300]}")

        sock.close()

    # -- Publish loop (4 Hz) --------------------------------------------------

    def _publish_loop(self) -> None:
        while not self._stop.is_set():
            # Check backoff gate
            if time.monotonic() < self._backoff_until:
                self._stop.wait(PUBLISH_INTERVAL_S)
                continue

            latest = self.queue.drain_latest()
            if latest is not None:
                try:
                    self.broadcaster.broadcast("telemetry", latest)
                    self.metrics.record_publish()
                    self._backoff_s = BASE_BACKOFF_S
                    self._backoff_until = 0.0
                    self._fetch_error_logged = False
                except (HTTPError, URLError, OSError) as exc:
                    self.metrics.record_error()
                    print(
                        f"[PUB] Publish failed (retry in {self._backoff_s:.0f}s): {exc}"
                    )
                    if not self._fetch_error_logged:
                        cause = getattr(exc, "reason", None)
                        if cause:
                            print(f"[PUB]   cause: {cause}")
                        self._fetch_error_logged = True
                    # Re-enqueue for retry
                    self.queue.push(latest)
                    self._backoff_until = time.monotonic() + self._backoff_s
                    self._backoff_s = min(self._backoff_s * 2, MAX_BACKOFF_S)

            self._stop.wait(PUBLISH_INTERVAL_S)

    # -- Tactical publish loop (1 Hz) -----------------------------------------

    def _tactical_loop(self) -> None:
        while not self._stop.is_set():
            with self._tactical_lock:
                dirty = self._tactical_dirty
                tac = self._latest_tactical

            if dirty and tac is not None:
                # Check backoff gate (shared with telemetry)
                if time.monotonic() >= self._backoff_until:
                    with self._tactical_lock:
                        self._tactical_dirty = False
                    try:
                        obj_count = len(tac.get("objects", []))
                        tgt_count = len(tac.get("targets", []))
                        nav_mode = tac.get("nav", {}).get("master_mode", "?") if isinstance(tac.get("nav"), dict) else "?"
                        route_count = len(tac.get("route", []))
                        print(
                            f"[PUB] Publishing tactical "
                            f"(obj={obj_count} tgt={tgt_count} "
                            f"nav={nav_mode} route={route_count})"
                        )
                        self.broadcaster.broadcast("tactical", tac)
                        self.metrics.record_tactical_publish()
                    except (HTTPError, URLError, OSError) as exc:
                        print(f"[PUB] Tactical publish failed: {exc}")
                        if not self._fetch_error_logged:
                            cause = getattr(exc, "reason", None)
                            if cause:
                                print(f"[PUB]   cause: {cause}")
                            self._fetch_error_logged = True
                        with self._tactical_lock:
                            self._tactical_dirty = True  # retry next cycle

            self._stop.wait(TACTICAL_INTERVAL_S)

    # -- Heartbeat loop (1 Hz) ------------------------------------------------

    def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            now = time.monotonic()
            dcs_active = (
                self._last_udp_at > 0
                and (now - self._last_udp_at) < STALENESS_TIMEOUT_S
            )
            self.metrics.record_dcs_silent(dcs_active)

            heartbeat = {
                "type": "heartbeat",
                "dcsActive": dcs_active,
                "packetCount": self.metrics.udp_received,
                "queueSize": self.queue.size,
            }
            try:
                self.broadcaster.broadcast("heartbeat", heartbeat)
            except (HTTPError, URLError, OSError):
                pass  # heartbeat failure is non-critical

            self._stop.wait(HEARTBEAT_INTERVAL_S)

    # -- Metrics log loop (5s) ------------------------------------------------

    def _metrics_loop(self) -> None:
        while not self._stop.is_set():
            self._stop.wait(METRICS_LOG_INTERVAL_S)
            if not self._stop.is_set():
                self.metrics.log_and_reset()

    # -- Start / Stop ---------------------------------------------------------

    def start(self) -> None:
        threads = [
            threading.Thread(target=self._udp_loop, name="udp", daemon=True),
            threading.Thread(target=self._publish_loop, name="publish", daemon=True),
            threading.Thread(target=self._heartbeat_loop, name="heartbeat", daemon=True),
            threading.Thread(target=self._tactical_loop, name="tactical", daemon=True),
            threading.Thread(target=self._metrics_loop, name="metrics", daemon=True),
        ]
        for t in threads:
            t.start()

    def stop(self) -> None:
        self._stop.set()


# -- Main ---------------------------------------------------------------------

def main() -> None:
    parser = ArgumentParser(description="JARVIS DCS Bridge - UDP to Supabase relay")
    parser.add_argument(
        "--channel", "-c",
        default=None,
        help=f"Supabase channel topic (default: {DEFAULT_CHANNEL})",
    )
    parser.add_argument(
        "--code",
        default=None,
        help="Pairing code from web dashboard (uses session:<code>)",
    )
    args = parser.parse_args()

    # Resolve credentials: env vars -> embedded defaults
    supabase_url = (
        os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
        or os.environ.get("SUPABASE_URL")
        or DEFAULT_SUPABASE_URL
    )
    supabase_key = (
        os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
        or os.environ.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
        or os.environ.get("SUPABASE_KEY")
        or DEFAULT_SUPABASE_KEY
    )
    using_defaults = supabase_url == DEFAULT_SUPABASE_URL

    # Resolve channel
    if args.channel:
        channel = args.channel
    elif args.code:
        channel = f"session:{args.code}"
    else:
        channel = os.environ.get("BRIDGE_CHANNEL", DEFAULT_CHANNEL)

    # Banner
    print()
    print(f"[BRIDGE] JARVIS DCS Bridge (Python) v{VERSION}")
    print(f"[BRIDGE] Credentials: {'embedded defaults (anon key)' if using_defaults else 'from environment'}")
    print(f"[BRIDGE] Supabase URL: {supabase_url}")
    print(f"[BRIDGE] Channel: {channel}")

    # Health check
    broadcaster = SupabaseBroadcaster(supabase_url, supabase_key, channel)
    broadcaster.health_check()

    if args.channel:
        print(f"[BRIDGE] Dev mode - using channel: {channel}")
    elif args.code:
        print(f"[BRIDGE] Pairing code: {args.code} -> channel: {channel}")
    else:
        print(f"[BRIDGE] No --channel or --code provided, using dev channel: {channel}")

    # Start bridge
    bridge = JarvisBridge(supabase_url, supabase_key, channel)
    bridge.start()

    print(f"[BRIDGE] Listening on UDP :{UDP_PORT}")
    print("[BRIDGE] Ready. Waiting for DCS telemetry...")
    print("[BRIDGE] Press Ctrl+C to stop.\n")

    # Graceful shutdown on Ctrl+C / SIGTERM
    def shutdown(signum: int, _frame: Any) -> None:
        sig_name = signal.Signals(signum).name
        print(f"\n[BRIDGE] Received {sig_name}, shutting down...")
        bridge.stop()
        print("[BRIDGE] Goodbye.")
        sys.exit(0)

    signal.signal(signal.SIGINT, shutdown)
    signal.signal(signal.SIGTERM, shutdown)

    # Keep main thread alive (signal handlers only fire on main thread)
    while True:
        time.sleep(1)


if __name__ == "__main__":
    main()
