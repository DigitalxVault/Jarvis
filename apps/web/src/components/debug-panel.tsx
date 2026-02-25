'use client'

interface DebugPanelProps {
  packetsPerSec: number
  lastPacketAt: number | null
  sessionId: string | null
  subscriptionStatus: string
}

export function DebugPanel({ packetsPerSec, lastPacketAt, sessionId, subscriptionStatus }: DebugPanelProps) {
  const lastPktDisplay = lastPacketAt
    ? `${((Date.now() - lastPacketAt) / 1000).toFixed(1)}s ago`
    : 'N/A'

  return (
    <div className="jarvis-panel">
      <div className="panel-title">▸ DEBUG PANEL</div>
      <div className="flex flex-col gap-2 text-[12px]">
        <div className="flex justify-between">
          <span className="opacity-45">PKTS/SEC</span>
          <span className="text-jarvis-accent glow-accent">{packetsPerSec.toFixed(1)}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-45">LAST PKT</span>
          <span>{lastPktDisplay}</span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-45">SESSION</span>
          <span className="text-[11px] font-mono opacity-70">
            {sessionId ? sessionId.slice(0, 8) + '...' : 'NONE'}
          </span>
        </div>
        <div className="flex justify-between">
          <span className="opacity-45">SUB STATUS</span>
          <span className={
            subscriptionStatus === 'SUBSCRIBED'
              ? 'text-jarvis-success glow-success'
              : 'text-jarvis-warning'
          }>
            {subscriptionStatus}
          </span>
        </div>
      </div>
    </div>
  )
}
