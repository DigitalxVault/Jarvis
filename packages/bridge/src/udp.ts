import dgram from 'node:dgram'
import type { TelemetryPacket, TacticalPacket } from '@jarvis-dcs/shared'
import { UDP_PORT } from '@jarvis-dcs/shared'
import { metrics } from './metrics.js'

export type UdpCallback = (packet: TelemetryPacket) => void
export type TacticalCallback = (packet: TacticalPacket) => void

export function createUdpListener(
  onPacket: UdpCallback,
  onTactical?: TacticalCallback,
): dgram.Socket {
  const server = dgram.createSocket('udp4')

  // One-time diagnostic: dump first non-telemetry packet raw BEFORE parsing
  let rawDumpDone = false

  server.on('message', (buf: Buffer) => {
    const str = buf.toString('utf8')

    // One-time: dump first non-telemetry packet raw (before JSON.parse)
    if (!rawDumpDone && !str.startsWith('{"type":"telemetry"')) {
      rawDumpDone = true
      console.log(`[UDP] *** RAW NON-TELEMETRY (${buf.length} bytes) ***`)
      console.log(`[UDP] ${str.slice(0, 500)}`)
    }

    try {
      const raw = JSON.parse(str)
      if (raw?.type === 'telemetry') {
        onPacket(raw as TelemetryPacket)
      } else if (raw?.type === 'tactical' && onTactical) {
        console.log(`[UDP] Tactical packet received (t=${raw.t_model}, objects=${raw.objects?.length ?? 0}, targets=${raw.targets?.length ?? 0})`)
        metrics.recordTacticalReceive()
        onTactical(raw as TacticalPacket)
      } else {
        console.warn(`[UDP] Unknown packet type="${raw?.type}" keys=[${Object.keys(raw ?? {}).join(',')}] size=${buf.length}`)
      }
    } catch (err) {
      console.error(`[UDP] Parse FAILED: ${(err as Error).message}`)
      console.error(`[UDP] Raw: ${str.slice(0, 300)}`)
    }
  })

  server.on('error', (err) => {
    console.error('[UDP] Socket error:', err.message)
    server.close()
  })

  server.bind(UDP_PORT, '0.0.0.0', () => {
    console.log(`[UDP] Listening on 0.0.0.0:${UDP_PORT}`)
  })

  return server
}
