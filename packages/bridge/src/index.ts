import 'dotenv/config'
import { parseArgs } from 'node:util'
import { getChannelName } from '@jarvis-dcs/shared'
import { createUdpListener } from './udp.js'
import { SupabasePublisher } from './publisher.js'
import { metrics } from './metrics.js'

// Parse CLI arguments
const { values } = parseArgs({
  options: {
    channel: { type: 'string', short: 'c' },
    code: { type: 'string' },
  },
  strict: false,
})

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL
const supabaseKey =
  process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseKey) {
  console.error('[BRIDGE] Missing SUPABASE_URL or SUPABASE_KEY environment variables')
  console.error('Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (or SUPABASE_SERVICE_ROLE_KEY)')
  process.exit(1)
}

async function main() {
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

  const udpSocket = createUdpListener((packet) => {
    metrics.recordUdpPacket()
    publisher.enqueue(packet)
  })

  metrics.start()
  publisher.start()

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
