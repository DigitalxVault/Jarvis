'use client'

import type { TacticalPacket } from '@jarvis-dcs/shared'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface TacticalHeaderProps {
  tactical: TacticalPacket | null
  connectionState: ConnectionState
}

export function TacticalHeader({ tactical, connectionState }: TacticalHeaderProps) {
  const masterMode = tactical?.nav?.master_mode ?? 'OFF'
  const subMode = tactical?.nav?.sub_mode ?? '---'
  const targetCount = (tactical?.targets?.length ?? 0)
  const lockedCount = (tactical?.locked?.length ?? 0)
  const objectCount = (tactical?.objects?.length ?? 0)

  const hasPermObjects = tactical?.permissions?.objects ?? false
  const hasPermSensors = tactical?.permissions?.sensors ?? false

  const modeColor = masterMode === 'OFF' ? 'text-jarvis-muted'
    : masterMode === 'NAV' ? 'text-jarvis-success'
    : masterMode === 'BVR' || masterMode === 'CAC' ? 'text-jarvis-danger'
    : masterMode === 'A2G' ? 'text-jarvis-warning'
    : 'text-jarvis-accent'

  const connectionColor = connectionState === 'connected' ? 'text-jarvis-success'
    : connectionState === 'dcs_offline' ? 'text-jarvis-warning'
    : 'text-jarvis-danger'

  return (
    <div className="bg-jarvis-bar/60 border-b border-jarvis-border px-4 py-2 flex items-center justify-between">
      {/* Mode display */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-45" style={{ letterSpacing: '1px' }}>MODE</span>
          <span className={`text-[14px] font-bold ${modeColor}`} style={{ letterSpacing: '2px' }}>
            {masterMode}
          </span>
          <span className="text-[11px] opacity-60">{subMode}</span>
        </div>

        {tactical?.nav?.autothrust && (
          <span className="text-[10px] text-jarvis-success" style={{ letterSpacing: '1px' }}>
            A/T ON
          </span>
        )}
      </div>

      {/* Contact info */}
      <div className="flex items-center gap-4">
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-45" style={{ letterSpacing: '1px' }}>TGT</span>
          <span className="text-[13px] font-bold text-jarvis-accent tabular-nums">{targetCount}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-45" style={{ letterSpacing: '1px' }}>LOCK</span>
          <span className={`text-[13px] font-bold tabular-nums ${lockedCount > 0 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-muted'}`}>
            {lockedCount}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] opacity-45" style={{ letterSpacing: '1px' }}>OBJ</span>
          <span className="text-[13px] font-bold text-jarvis-primary tabular-nums">{objectCount}</span>
        </div>
      </div>

      {/* Permissions + connection */}
      <div className="flex items-center gap-3">
        {!hasPermObjects && (
          <span className="text-[9px] text-jarvis-warning opacity-60" style={{ letterSpacing: '1px' }}>
            OBJ GATED
          </span>
        )}
        {!hasPermSensors && (
          <span className="text-[9px] text-jarvis-warning opacity-60" style={{ letterSpacing: '1px' }}>
            SNS GATED
          </span>
        )}
        <span className={`text-[10px] ${connectionColor}`}>
          ● {connectionState === 'connected' ? 'LIVE' : connectionState.toUpperCase()}
        </span>
      </div>
    </div>
  )
}
