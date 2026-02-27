import type { TelemetryPacket, TacticalPacket, HeartbeatPacket } from '@jarvis-dcs/shared'
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
  private backoffUntilMs = 0
  private totalPublished = 0

  // Tactical packet (latest only, overwritten on each receive)
  private latestTactical: TacticalPacket | null = null
  private tacticalDirty = false
  private tacticalTimer: ReturnType<typeof setInterval> | null = null

  constructor(supabaseUrl: string, apiKey: string, channelTopic: string) {
    this.supabaseUrl = supabaseUrl
    this.apiKey = apiKey
    this.channelTopic = channelTopic
  }

  enqueue(packet: TelemetryPacket): void {
    this.queue.push(packet)
    this.lastUdpAt = Date.now()
  }

  enqueueTactical(packet: TacticalPacket): void {
    this.latestTactical = packet
    this.tacticalDirty = true
    this.lastUdpAt = Date.now()
  }

  start(): void {
    console.log(`[PUB] Publishing to channel: ${this.channelTopic}`)

    // Publish loop — runs at PUBLISH_RATE_HZ
    this.publishTimer = setInterval(() => this.publishLatest(), PUBLISH_INTERVAL_MS)

    // Heartbeat loop — 1 Hz
    this.heartbeatTimer = setInterval(() => this.sendHeartbeat(), HEARTBEAT_INTERVAL_MS)

    // Tactical publish loop — 1 Hz (matches DCS send rate)
    this.tacticalTimer = setInterval(() => this.publishTactical(), 1000)
  }

  stop(): void {
    if (this.publishTimer) clearInterval(this.publishTimer)
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer)
    if (this.tacticalTimer) clearInterval(this.tacticalTimer)
  }

  private async publishLatest(): Promise<void> {
    if (Date.now() < this.backoffUntilMs) return
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
      this.backoffUntilMs = 0
    } catch (err) {
      metrics.recordError()
      console.error(`[PUB] Publish failed (retry in ${this.backoffMs}ms):`, (err as Error).message)
      // Re-enqueue for retry
      this.queue.push(latest)
      this.backoffMs = Math.min(this.backoffMs * 2, MAX_BACKOFF_MS)
      this.backoffUntilMs = Date.now() + this.backoffMs
    }
  }

  private async publishTactical(): Promise<void> {
    if (!this.tacticalDirty || !this.latestTactical) return
    if (Date.now() < this.backoffUntilMs) return

    this.tacticalDirty = false
    try {
      await this.broadcast('tactical', this.latestTactical)
    } catch {
      // Tactical publish failure is non-critical — next cycle will retry
      this.tacticalDirty = true
    }
  }

  private async sendHeartbeat(): Promise<void> {
    const dcsActive = Date.now() - this.lastUdpAt < STALENESS_TIMEOUT_MS
    metrics.recordDcsSilent(dcsActive)

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
      signal: AbortSignal.timeout(5000),
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
