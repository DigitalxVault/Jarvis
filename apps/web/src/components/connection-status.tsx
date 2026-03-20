'use client'

import type { ConnectionState } from '@/hooks/use-telemetry'

const STATUS_CONFIG: Record<ConnectionState, { label: string; color: string; dotClass: string; spinning: boolean }> = {
  connecting: {
    label: 'CONNECTING',
    color: 'text-jarvis-accent',
    dotClass: 'bg-jarvis-accent',
    spinning: true,
  },
  reconnecting: {
    label: 'RECONNECTING',
    color: 'text-jarvis-accent',
    dotClass: 'bg-jarvis-accent',
    spinning: true,
  },
  dcs_offline: {
    label: 'AWAITING DCS',
    color: 'text-jarvis-warning',
    dotClass: 'bg-jarvis-warning',
    spinning: false,
  },
  connected: {
    label: 'DCS ONLINE',
    color: 'text-jarvis-success glow-success',
    dotClass: 'bg-jarvis-success',
    spinning: false,
  },
  offline: {
    label: 'OFFLINE',
    color: 'text-jarvis-danger',
    dotClass: 'bg-jarvis-danger',
    spinning: false,
  },
}

export function ConnectionStatus({ state }: { state: ConnectionState }) {
  const config = STATUS_CONFIG[state]

  return (
    <div className="flex items-center gap-2">
      <span className="relative inline-flex items-center justify-center w-3 h-3">
        <span className={`status-dot ${config.dotClass}`} />
        {config.spinning && (
          <span className="absolute animate-spin rounded-full border-[1.5px] border-t-jarvis-accent border-r-transparent border-b-transparent border-l-transparent w-4 h-4" />
        )}
      </span>
      <span
        className={`text-[12px] font-bold ${config.color}`}
        style={{ letterSpacing: '2px' }}
      >
        {config.label}
      </span>
    </div>
  )
}
