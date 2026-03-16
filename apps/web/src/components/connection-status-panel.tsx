'use client'

import { useRef } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface ConnectionStatusPanelProps {
  connectionState: ConnectionState
}

type UIConnectionState = 'INITIALIZING' | 'SYSTEM_INITIALIZED' | 'DCS_ONLINE' | 'DCS_OFFLINE'

const STATUS_CONFIG: Record<UIConnectionState, {
  label: string
  subText: string
  color: string
  dotColor: string
  spinning: boolean
}> = {
  INITIALIZING: {
    label: 'INITIALIZING',
    subText: 'Connecting to bridge...',
    color: 'text-jarvis-accent',
    dotColor: 'bg-jarvis-accent',
    spinning: true,
  },
  SYSTEM_INITIALIZED: {
    label: 'SYSTEM INITIALIZED',
    subText: 'Awaiting DCS launch...',
    color: 'text-jarvis-warning',
    dotColor: 'bg-jarvis-warning',
    spinning: false,
  },
  DCS_ONLINE: {
    label: 'DCS ONLINE',
    subText: 'Telemetry streaming',
    color: 'text-jarvis-success',
    dotColor: 'bg-jarvis-success',
    spinning: false,
  },
  DCS_OFFLINE: {
    label: 'DCS OFFLINE',
    subText: 'DCS connection lost',
    color: 'text-jarvis-danger',
    dotColor: 'bg-jarvis-danger',
    spinning: false,
  },
}

function deriveUIState(
  connectionState: ConnectionState,
  hadTelemetry: boolean
): UIConnectionState {
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return 'INITIALIZING'
  }
  if (connectionState === 'connected') {
    return 'DCS_ONLINE'
  }
  if (connectionState === 'dcs_offline') {
    return hadTelemetry ? 'DCS_OFFLINE' : 'SYSTEM_INITIALIZED'
  }
  // connectionState === 'offline' — show as initializing (auto-connect pending)
  return 'INITIALIZING'
}

export function ConnectionStatusPanel({
  connectionState,
}: ConnectionStatusPanelProps) {
  const hadTelemetryRef = useRef<boolean>(false)

  // Track whether we've ever received telemetry
  if (connectionState === 'connected') {
    hadTelemetryRef.current = true
  }

  const uiState = deriveUIState(connectionState, hadTelemetryRef.current)

  return (
    <div className="jarvis-panel p-2">
      <div className="panel-title">&#x25b8; CONNECTION</div>

      <div className="flex flex-col gap-3 mt-2">
        {/* 4-state status display with crossfade */}
        <div key={uiState} className="animate-fade-in text-center">
          {/* Status dot with optional spinning ring */}
          <div className="flex items-center justify-center gap-2 mb-1">
            <span className="relative inline-flex items-center justify-center w-5 h-5">
              {/* Core dot */}
              <span className={`${STATUS_CONFIG[uiState].dotColor} w-3 h-3 rounded-full inline-block`} />
              {/* Spinning ring — only during INITIALIZING */}
              {STATUS_CONFIG[uiState].spinning && (
                <span className="absolute animate-spin border-2 border-t-jarvis-accent border-r-transparent border-b-transparent border-l-transparent rounded-full w-5 h-5" />
              )}
            </span>
            <span
              className={`text-[14px] font-bold tracking-[3px] ${STATUS_CONFIG[uiState].color}`}
            >
              {STATUS_CONFIG[uiState].label}
            </span>
          </div>
          <div
            className="text-[12px] opacity-50"
            style={{ letterSpacing: '2px' }}
          >
            {STATUS_CONFIG[uiState].subText}
          </div>
        </div>
      </div>
    </div>
  )
}
