#!/usr/bin/env python3
"""
JARVIS DCS Bridge — Standalone Python Edition
Relays DCS telemetry (UDP) to Supabase Realtime broadcast.

Zero dependencies — Python 3.10+ stdlib only.
Just run: python jarvis_bridge.py

Optional:
    python jarvis_bridge.py --channel session:dev
    SUPABASE_URL=... SUPABASE_KEY=... python jarvis_bridge.py
"""

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
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

# ── Constants (matching packages/shared/src/constants.ts) ────────────────────

UDP_PORT = 7779
PUBLISH_INTERVAL_S = 0.250        # 4 Hz
HEARTBEAT_INTERVAL_S = 1.0        # 1 Hz
STALENESS_TIMEOUT_S = 3.0         # DCS considered silent after 3s
METRICS_LOG_INTERVAL_S = 5.0      # log metrics every 5s
MAX_QUEUE_SIZE = 100
BASE_BACKOFF_S = 1.0
MAX_BACKOFF_S = 30.0

# ── Default Supabase credentials (safe to embed — anon key is public) ───────

DEFAULT_SUPABASE_URL = "https://cvqvxaiyuauprnceikkv.supabase.co"
DEFAULT_SUPABASE_KEY = (
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9."
    "eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXZ4YWl5dWF1cHJuY2Vpa2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTY2MTksImV4cCI6MjA4NzU3MjYxOX0."
    "G3rQI-x6cxAWEN9No8AWWyC_hBTj_vFRzm6QKyMX3sU"
)
DEFAULT_CHANNEL = "session:dev"


# ── Bounded Queue ────────────────────────────────────────────────────────────

class BoundedQueue:
    """Thread-safe bounded FIFO queue. Drops oldest items on overflow."""

    def __init__(self, maxsize: int = MAX_QUEUE_SIZE):
        self._deque: deque = deque(maxlen=maxsize)
        self._lock = threading.Lock()

    def push(self, item: object) -> None:
        with self._lock:
            self._deque.append(item)

    def drain_latest(self) -> object | None:
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


# ── Metrics ──────────────────────────────────────────────────────────────────

class Metrics:
    def __init__(self):
        self._lock = threading.Lock()
        self.udp_received = 0
        self.published = 0
        self.errors = 0
        self._last_log_at = time.monotonic()
        self._last_udp_at = 0.0

    def record_udp(self) -> None:
        with self._lock:
            self.udp_received += 1
            self._last_udp_at = time.monotonic()

    def record_publish(self) -> None:
        with self._lock:
            self.published += 1

    def record_error(self) -> None:
        with self._lock:
            self.errors += 1

    def log(self) -> None:
        with self._lock:
            elapsed = max(time.monotonic() - self._last_log_at, 0.001)
            rate = self.udp_received / elapsed
            print(
                f"[METRICS] udp={self.udp_received} pub={self.published} "
                f"err={self.errors} rate={rate:.1f}/s"
            )
            self._last_log_at = time.monotonic()
            self.udp_received = 0
            self.published = 0
            self.errors = 0


# ── Supabase Broadcast ──────────────────────────────────────────────────────

def _make_ssl_context() -> ssl.SSLContext:
    """Create an SSL context that works across platforms.

    On Windows this just works. On macOS with python.org Python, the default
    cert store is empty — so we fall back to an unverified context with a
    warning rather than crashing.
    """
    ctx = ssl.create_default_context()
    try:
        # Quick probe — will raise on macOS if certs are missing
        ctx.load_default_certs()  # type: ignore[attr-defined]
    except (AttributeError, ssl.SSLError):
        pass

    return ctx


class SupabaseBroadcaster:
    def __init__(self, url: str, key: str, channel: str):
        self.endpoint = f"{url}/realtime/v1/api/broadcast"
        self.key = key
        self.channel = channel
        self._ssl_ctx: ssl.SSLContext | None = _make_ssl_context()
        self._ssl_warned = False

    def send(self, event: str, payload: dict) -> None:
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
                        "[SSL] Certificate verification failed — falling back "
                        "to unverified mode.\n"
                        "      On macOS, run: /Applications/Python 3.x/"
                        "Install Certificates.command"
                    )
                    self._ssl_warned = True
                self._ssl_ctx = ssl.create_default_context()
                self._ssl_ctx.check_hostname = False
                self._ssl_ctx.verify_mode = ssl.CERT_NONE
                # Retry with unverified context
                with urlopen(req, timeout=5, context=self._ssl_ctx) as resp:
                    resp.read()
            else:
                raise


# ── Bridge ───────────────────────────────────────────────────────────────────

class JarvisBridge:
    def __init__(self, supabase_url: str, supabase_key: str, channel: str):
        self.queue = BoundedQueue()
        self.metrics = Metrics()
        self.broadcaster = SupabaseBroadcaster(supabase_url, supabase_key, channel)
        self.channel = channel

        self._last_udp_at = 0.0    # wall-clock of last UDP packet
        self._backoff_s = BASE_BACKOFF_S
        self._stop = threading.Event()  # set() to signal shutdown

    # ── UDP listener (runs in its own thread) ────────────────────────────

    def _udp_loop(self) -> None:
        sock = socket.socket(socket.AF_INET, socket.SOCK_DGRAM)
        sock.setsockopt(socket.SOL_SOCKET, socket.SO_REUSEADDR, 1)
        sock.settimeout(1.0)  # allows checking _running flag
        sock.bind(("0.0.0.0", UDP_PORT))
        print(f"[UDP] Listening on 0.0.0.0:{UDP_PORT}")

        while not self._stop.is_set():
            try:
                data, _addr = sock.recvfrom(65535)
            except socket.timeout:
                continue
            except OSError:
                break

            try:
                pkt = json.loads(data.decode("utf-8"))
                if pkt.get("type") != "telemetry":
                    continue
                self.metrics.record_udp()
                self._last_udp_at = time.time()
                self.queue.push(pkt)
            except (json.JSONDecodeError, UnicodeDecodeError):
                pass  # malformed — silently drop

        sock.close()

    # ── Publish loop (4 Hz) ──────────────────────────────────────────────

    def _publish_loop(self) -> None:
        while not self._stop.is_set():
            latest = self.queue.drain_latest()
            if latest is not None:
                try:
                    self.broadcaster.send("telemetry", latest)
                    self.metrics.record_publish()
                    self._backoff_s = BASE_BACKOFF_S  # reset on success
                except (HTTPError, URLError, OSError) as exc:
                    self.metrics.record_error()
                    print(
                        f"[PUB] Publish failed (retry in {self._backoff_s:.0f}s): {exc}"
                    )
                    # Re-enqueue for next cycle
                    self.queue.push(latest)
                    self._backoff_s = min(self._backoff_s * 2, MAX_BACKOFF_S)

            self._stop.wait(PUBLISH_INTERVAL_S)

    # ── Heartbeat loop (1 Hz) ────────────────────────────────────────────

    def _heartbeat_loop(self) -> None:
        while not self._stop.is_set():
            now = time.time()
            dcs_active = (
                self._last_udp_at > 0
                and (now - self._last_udp_at) < STALENESS_TIMEOUT_S
            )

            if not dcs_active and self._last_udp_at > 0:
                elapsed = now - self._last_udp_at
                if elapsed < STALENESS_TIMEOUT_S * 2:
                    print("[METRICS] DCS_SILENT — no UDP packet for 3s")

            heartbeat = {
                "type": "heartbeat",
                "dcsActive": dcs_active,
                "packetCount": self.metrics.udp_received,
                "queueSize": self.queue.size,
            }
            try:
                self.broadcaster.send("heartbeat", heartbeat)
            except (HTTPError, URLError, OSError):
                pass  # heartbeat failure is non-critical

            self._stop.wait(HEARTBEAT_INTERVAL_S)

    # ── Metrics log loop (5s) ────────────────────────────────────────────

    def _metrics_loop(self) -> None:
        while not self._stop.is_set():
            self._stop.wait(METRICS_LOG_INTERVAL_S)
            if not self._stop.is_set():
                self.metrics.log()

    # ── Start / Stop ─────────────────────────────────────────────────────

    def start(self) -> None:
        threads = [
            threading.Thread(target=self._udp_loop, name="udp", daemon=True),
            threading.Thread(target=self._publish_loop, name="publish", daemon=True),
            threading.Thread(target=self._heartbeat_loop, name="heartbeat", daemon=True),
            threading.Thread(target=self._metrics_loop, name="metrics", daemon=True),
        ]
        for t in threads:
            t.start()

    def stop(self) -> None:
        self._stop.set()


# ── Main ─────────────────────────────────────────────────────────────────────

def main() -> None:
    parser = ArgumentParser(description="JARVIS DCS Bridge — UDP to Supabase relay")
    parser.add_argument(
        "--channel", "-c",
        default=None,
        help=f"Supabase channel topic (default: {DEFAULT_CHANNEL})",
    )
    args = parser.parse_args()

    supabase_url = os.environ.get("SUPABASE_URL", DEFAULT_SUPABASE_URL)
    supabase_key = os.environ.get("SUPABASE_KEY", DEFAULT_SUPABASE_KEY)
    channel = args.channel or os.environ.get("BRIDGE_CHANNEL", DEFAULT_CHANNEL)

    print("=" * 60)
    print("  JARVIS DCS Bridge  —  Python Standalone Edition")
    print("=" * 60)
    print(f"  Supabase : {supabase_url}")
    print(f"  Channel  : {channel}")
    print(f"  UDP Port : {UDP_PORT}")
    print(f"  Publish  : {1 / PUBLISH_INTERVAL_S:.0f} Hz")
    print("=" * 60)
    print()

    bridge = JarvisBridge(supabase_url, supabase_key, channel)
    bridge.start()
    print("[BRIDGE] Ready. Waiting for DCS telemetry on UDP...")
    print("[BRIDGE] Press Ctrl+C to stop.\n")

    # Graceful shutdown on Ctrl+C / SIGTERM
    def shutdown(signum, _frame):
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
