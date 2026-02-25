/** UDP port the bridge listens on for DCS telemetry */
export const UDP_PORT = 7779

/** Target publish rate from bridge to Supabase (Hz) */
export const PUBLISH_RATE_HZ = 4

/** Minimum interval between Supabase publishes (ms) */
export const PUBLISH_INTERVAL_MS = 1000 / PUBLISH_RATE_HZ // 250ms

/** If no UDP packet for this many ms, consider DCS silent */
export const STALENESS_TIMEOUT_MS = 3000

/** Maximum items in the publish queue before dropping oldest */
export const MAX_QUEUE_SIZE = 100

/** Bridge heartbeat interval (ms) */
export const HEARTBEAT_INTERVAL_MS = 1000

/** Metrics logging interval (ms) */
export const METRICS_LOG_INTERVAL_MS = 5000

/** Pairing code character set — no ambiguous chars (0/O, 1/I/L) */
export const PAIRING_CHARSET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'

/** Pairing code length */
export const PAIRING_CODE_LENGTH = 6

/** Pairing code TTL in minutes */
export const PAIRING_CODE_TTL_MINUTES = 5

/** Max raw packets to display in the debug viewer */
export const MAX_RAW_PACKETS = 20
