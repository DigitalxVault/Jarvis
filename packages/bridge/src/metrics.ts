import { METRICS_LOG_INTERVAL_MS, STALENESS_TIMEOUT_MS } from '@jarvis-dcs/shared'

class Metrics {
  udpReceived = 0
  published = 0
  errors = 0
  private lastLogAt = Date.now()
  private lastUdpAt = 0
  private logTimer: ReturnType<typeof setInterval> | null = null

  recordUdpPacket(): void {
    this.udpReceived++
    this.lastUdpAt = Date.now()
  }

  recordPublish(): void {
    this.published++
  }

  recordError(): void {
    this.errors++
  }

  recordDcsSilent(): void {
    // Only log once per staleness period
    if (Date.now() - this.lastUdpAt > STALENESS_TIMEOUT_MS * 2) return
    console.warn('[METRICS] DCS_SILENT — no UDP packet for 3s')
  }

  start(): void {
    this.logTimer = setInterval(() => this.log(), METRICS_LOG_INTERVAL_MS)
  }

  stop(): void {
    if (this.logTimer) clearInterval(this.logTimer)
  }

  private log(): void {
    const elapsed = (Date.now() - this.lastLogAt) / 1000
    const udpRate = ((this.udpReceived) / Math.max(elapsed, 1)).toFixed(1)
    console.log(
      `[METRICS] udp=${this.udpReceived} pub=${this.published} err=${this.errors} rate=${udpRate}/s`
    )
    this.lastLogAt = Date.now()
    this.udpReceived = 0
    this.published = 0
    this.errors = 0
  }
}

export const metrics = new Metrics()
