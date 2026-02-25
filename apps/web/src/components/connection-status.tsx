'use client'

import type { ConnectionState } from '@/hooks/use-telemetry'

const STATUS_CONFIG: Record<ConnectionState, { label: string; color: string; dotClass: string }> = {
  connected: {
    label: 'CONNECTED',
    color: 'text-jarvis-success glow-success',
    dotClass: 'bg-jarvis-success animate-blink',
  },
  dcs_offline: {
    label: 'DCS OFFLINE',
    color: 'text-jarvis-warning',
    dotClass: 'bg-jarvis-warning animate-blink',
  },
  reconnecting: {
    label: 'RECONNECTING',
    color: 'text-jarvis-primary glow-text',
    dotClass: 'bg-jarvis-primary animate-pulse-glow',
  },
  connecting: {
    label: 'CONNECTING',
    color: 'text-jarvis-primary',
    dotClass: 'bg-jarvis-primary animate-pulse-glow',
  },
  offline: {
    label: 'OFFLINE',
    color: 'text-jarvis-danger glow-danger',
    dotClass: 'bg-jarvis-danger',
  },
}

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const config = STATUS_CONFIG[state]

  return (
    <div className="flex items-center gap-2">
      <span className={`status-dot ${config.dotClass}`} />
      <span
        className={`text-[9px] font-bold ${config.color}`}
        style={{ letterSpacing: '2px' }}
      >
        {config.label}
      </span>
    </div>
  )
}
