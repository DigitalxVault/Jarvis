import 'dotenv/config'
import { parseArgs } from 'node:util'
import { writeHeapSnapshot } from 'node:v8'
import { getChannelName } from '@jarvis-dcs/shared'
import { createUdpListener } from './udp.js'
import { SupabasePublisher } from './publisher.js'
import { metrics } from './metrics.js'

// Default Supabase credentials (safe to embed — anon key is public, same as Python bridge)
const DEFAULT_SUPABASE_URL = 'https://cvqvxaiyuauprnceikkv.supabase.co'
const DEFAULT_SUPABASE_KEY =
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.' +
  'eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImN2cXZ4YWl5dWF1cHJuY2Vpa2t2Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzE5OTY2MTksImV4cCI6MjA4NzU3MjYxOX0.' +
  'G3rQI-x6cxAWEN9No8AWWyC_hBTj_vFRzm6QKyMX3sU'

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    channel: { type: 'string', short: 'c' },
    code: { type: 'string' },
  },
  strict: false,
})

// Resolve credentials: env vars → embedded defaults
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || DEFAULT_SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_SUPABASE_KEY
const usingDefaults = supabaseUrl === DEFAULT_SUPABASE_URL

async function main() {
  // ── Startup diagnostics ──
  console.log(`[BRIDGE] Supabase URL: ${supabaseUrl}`)
  console.log(`[BRIDGE] Credentials: ${usingDefaults ? 'embedded defaults (anon key)' : 'from environment'}`)

  // Health check — verify Supabase is reachable before starting
  try {
    const healthRes = await fetch(`${supabaseUrl}/rest/v1/`, {
      method: 'GET',
      signal: AbortSignal.timeout(5000),
      headers: { apikey: supabaseKey },
    })
    console.log(`[BRIDGE] Supabase reachable (HTTP ${healthRes.status})`)
  } catch (err) {
    const cause = (err as any)?.cause
    console.error('[BRIDGE] Supabase health check FAILED:', (err as Error).message)
    if (cause) console.error('[BRIDGE]   cause:', cause)
    console.error('[BRIDGE]   URL used:', supabaseUrl)
    console.error('[BRIDGE]   Check: network connectivity, DNS resolution, firewall rules')
    // Don't exit — let the bridge start anyway so UDP listener captures packets.
    // Publish errors will trigger backoff and retry.
  }

  let channelTopic: string

  if (typeof values.channel === 'string') {
    // Direct channel mode (for development)
    channelTopic = values.channel
    console.log(`[BRIDGE] Dev mode — using channel: ${channelTopic}`)
  } else if (typeof values.code === 'string') {
    // Pairing code mode — claim the code to get the channel
    console.log(`[BRIDGE] Claiming pairing code: ${values.code}`)
    // TODO: Implement POST /api/bridge/claim call
    // For now, use a placeholder channel
    channelTopic = getChannelName(values.code)
    console.log(`[BRIDGE] Paired to channel: ${channelTopic}`)
  } else {
    // Default dev channel
    channelTopic = 'session:dev'
    console.log('[BRIDGE] No --channel or --code provided, using dev channel: session:dev')
  }

  const publisher = new SupabasePublisher(supabaseUrl!, supabaseKey!, channelTopic)

  const udpSocket = createUdpListener(
    (packet) => {
      metrics.recordUdpPacket()
      publisher.enqueue(packet)
    },
    (tactical) => {
      publisher.enqueueTactical(tactical)
    },
  )

  metrics.start()
  publisher.start()

  const snapshotAt = (label: string, delayMs: number) => {
    setTimeout(() => {
      const path = writeHeapSnapshot()
      console.log(`[BRIDGE] Heap snapshot (${label}): ${path}`)
    }, delayMs)
  }
  snapshotAt('t=0', 0)
  snapshotAt('t=5min', 5 * 60_000)
  snapshotAt('t=20min', 20 * 60_000)

  console.log('[BRIDGE] Ready. Waiting for DCS telemetry on UDP...')

  // Graceful shutdown
  const shutdown = () => {
    console.log('\n[BRIDGE] Shutting down...')
    publisher.stop()
    metrics.stop()
    udpSocket.close(() => {
      console.log('[BRIDGE] Goodbye.')
      process.exit(0)
    })
  }

  process.on('SIGINT', shutdown)
  process.on('SIGTERM', shutdown)
}

main().catch((err) => {
  console.error('[BRIDGE] Fatal error:', err)
  process.exit(1)
})
