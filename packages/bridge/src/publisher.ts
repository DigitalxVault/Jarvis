import type { TelemetryPacket, HeartbeatPacket } from '@jarvis-dcs/shared'
import {
  PUBLISH_INTERVAL_MS,
  STALENESS_TIMEOUT_MS,
  HEARTBEAT_INTERVAL_MS,
} from '@jarvis-dcs/shared'
import { BoundedQueue } from './queue.js'
import { metrics } from './metrics.js'

const MAX_BACKOFF_MS = 30_000
const BASE_BACKOFF_MS = 1_000

export class SupabasePublisher {
  private supabaseUrl: string
  private apiKey: string
  private channelTopic: string
  private queue = new BoundedQueue<TelemetryPacket>()
  private publishTimer: ReturnType<typeof setInterval> | null = null
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null
  private lastUdpAt = 0
  private backoffMs = BASE_BACKOFF_MS
  private totalPublished = 0

  constructor(supabaseUrl: string, apiKey: string, channelTopic: string) {
    this.supabaseUrl = supabaseUrl
    this.apiKey = apiKey
    this.channelTopic = channelTopic
  }

  enqueue(packet: TelemetryPacket): void {
    this.queue.push(packet)
    this.lastUdpAt = Date.now()
  }

  start(): void {
    console.log(`[PUB] Publishing to channel: ${this.channelTopic}`)

    // Publish loop — runs at PUBLISH_RATE_HZ
    this.publishTimer = setInterval(() => this.publishLatest(), PUBLISH_INTERVAL_MS)

    // Heartbeat loop — 1 Hz
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS)
  }

  stop(): void {
    if (this.publishTimer) clearInterval(this.publishTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
  }

  private async publishLatest(): Promise<void> {
    // Take the latest packet from queue (skip older ones)
    let latest: TelemetryPacket | undefined
    while (this.queue.size > 0) {
      latest = this.queue.shift()
    }
    if (!latest) return

    try {
      await this.broadcast('telemetry', latest)
      this.totalPublished++
      metrics.recordPublish()
      this.backoffMs = BASE_BACKOFF_MS // reset on success
    } catch (err) {
      metrics.recordError()
      console.error(`[PUB] Publish failed (retry in ${this.backoffMs}ms):`, (err as Error).message)
      // Re-enqueue for retry
      this.queue.push(latest)
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const dcsActive = Date.now() - this.lastUdpAt < STALENESS_TIMEOUT_MS
    if (!dcsActive && this.lastUdpAt > 0) {
      metrics.recordDcsSilent()
    }

    const heartbeat: HeartbeatPacket = {
      type: 'heartbeat',
      dcsActive,
      packetCount: metrics.udpReceived,
      queueSize: this.queue.size,
    }

    try {
      await this.broadcast('heartbeat', heartbeat)
    } catch {
      // Heartbeat failure is non-critical
    }
  }

  private async broadcast(event: string, payload: unknown): Promise<void> {
    const res = await fetch(`${this.supabaseUrl}/realtime/v1/api/broadcast`, {
      method: 'POST',
      headers: {
        apikey: this.apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messages: [
          {
            topic: this.channelTopic,
            event,
            payload,
          },
        ],
      }),
    })

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`)
    }
  }
}
