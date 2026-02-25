import { METRICS_LOG_INTERVAL_MS } from '@jarvis-dcs/shared'

class Metrics {
  udpReceived = 0
  published = 0
  errors = 0
  private lastLogAt = Date.now()
  private wasDcsActive = true
  private logTimer: ReturnType<typeof setInterval> | null = null

  recordUdpPacket(): void {
    this.udpReceived++
  }

  recordPublish(): void {
    this.published++
  }

  recordError(): void {
    this.errors++
  }

  recordDcsSilent(dcsActive: boolean): void {
    if (!dcsActive && this.wasDcsActive) {
      console.warn('[BRIDGE] DCS_SILENT - no UDP packet for 3s')
    }
    this.wasDcsActive = dcsActive
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
    const { heapUsed, rss } = process.memoryUsage()
    const mb = (n: number) => (n / 1024 / 1024).toFixed(1)
    console.log(
      `[METRICS] udp=${this.udpReceived} pub=${this.published} err=${this.errors} rate=${udpRate}/s heap=${mb(heapUsed)}MB rss=${mb(rss)}MB`
    )
    this.lastLogAt = Date.now()
    this.udpReceived = 0
    this.published = 0
    this.errors = 0
  }
}

export const metrics = new Metrics()
