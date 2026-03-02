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

  // One-time diagnostic: log first non-telemetry packet for debugging
  let tacticalDiagDone = false

  server.on('message', (buf: Buffer) => {
    try {
      const raw = JSON.parse(buf.toString('utf8'))
      if (raw?.type === 'telemetry') {
        onPacket(raw as TelemetryPacket)
      } else if (raw?.type === 'tactical' && onTactical) {
        console.log(`[UDP] Tactical packet received (t=${raw.t_model}, objects=${raw.objects?.length ?? 0}, targets=${raw.targets?.length ?? 0})`)
        metrics.recordTacticalReceive()
        onTactical(raw as TacticalPacket)
      } else {
        // Unknown type — log once
        if (!tacticalDiagDone) {
          tacticalDiagDone = true
          console.warn(`[UDP] Unknown packet type="${raw?.type}" keys=[${Object.keys(raw ?? {}).join(',')}] size=${buf.length}`)
        }
      }
    } catch (err) {
      // Log parse failures once
      if (!tacticalDiagDone) {
        tacticalDiagDone = true
        const preview = buf.toString('utf8', 0, Math.min(200, buf.length))
        console.error(`[UDP] JSON parse failed (size=${buf.length}): ${(err as Error).message}`)
        console.error(`[UDP] Raw preview: ${preview}`)
      }
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
