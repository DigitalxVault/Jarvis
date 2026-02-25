import dgram from 'node:dgram'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { UDP_PORT } from '@jarvis-dcs/shared'

export type UdpCallback = (packet: TelemetryPacket) => void

export function createUdpListener(onPacket: UdpCallback): dgram.Socket {
  const server = dgram.createSocket('udp4')

  server.on('message', (buf: Buffer) => {
    try {
      const raw = JSON.parse(buf.toString('utf8'))
      if (raw?.type !== 'telemetry') return
      onPacket(raw as TelemetryPacket)
    } catch {
      // Malformed packet — silently drop
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
