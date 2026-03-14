'use client'

import { useRef, useEffect } from 'react'
import type { Session } from '@jarvis-dcs/shared'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface ConnectionStatusPanelProps {
  currentSession: Session | null
  connectionState: ConnectionState
  onCreateSession: () => void
  isCreating: boolean
  sessionError: string | null
  onClearError: () => void
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
): UIConnectionState | null {
  if (connectionState === 'connecting' || connectionState === 'reconnecting') {
    return 'INITIALIZING'
  }
  if (connectionState === 'connected') {
    return 'DCS_ONLINE'
  }
  if (connectionState === 'dcs_offline') {
    return hadTelemetry ? 'DCS_OFFLINE' : 'SYSTEM_INITIALIZED'
  }
  // connectionState === 'offline' — pre-session, no status display
  return null
}

export function ConnectionStatusPanel({
  currentSession,
  connectionState,
  onCreateSession,
  isCreating,
  sessionError,
  onClearError,
}: ConnectionStatusPanelProps) {
  const hadTelemetryRef = useRef<boolean>(false)

  // Track whether we've ever received telemetry in this session
  if (connectionState === 'connected') {
    hadTelemetryRef.current = true
  }

  // Reset hadTelemetry when session is cleared
  useEffect(() => {
    if (!currentSession) {
      hadTelemetryRef.current = false
    }
  }, [currentSession])

  const uiState = currentSession
    ? deriveUIState(connectionState, hadTelemetryRef.current)
    : null

  return (
    <div className="jarvis-panel p-2">
      <div className="panel-title">&#x25b8; CONNECTION</div>

      {!currentSession ? (
        <>
          <button
            onClick={onCreateSession}
            disabled={isCreating}
            className="w-full mt-1.5 border border-jarvis-border rounded px-3 py-1.5 text-[12px] font-bold tracking-[3px] text-jarvis-primary hover:bg-jarvis-primary/10 transition-colors disabled:opacity-30 cursor-pointer"
          >
            {isCreating ? 'INITIALIZING...' : 'START SESSION'}
          </button>

          {/* Error display */}
          {sessionError && (
            <div className="mt-3 border border-jarvis-danger/50 rounded px-3 py-2 bg-jarvis-danger/10">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="text-[12px] text-jarvis-danger tracking-wider mb-1">ERROR</div>
                  <div className="text-[13px] text-jarvis-danger/90">{sessionError}</div>
                </div>
                <button
                  onClick={onClearError}
                  className="text-jarvis-danger/50 hover:text-jarvis-danger text-[16px] leading-none cursor-pointer"
                >
                  ×
                </button>
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {/* 4-state status display with crossfade */}
          {uiState && (
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
          )}

          {/* Pairing code block */}
          {currentSession.pairing_code && !currentSession.bridge_claimed && (
            <div className="text-center">
              <div className="text-[13px] opacity-45 mb-1" style={{ letterSpacing: '2px' }}>
                PAIRING CODE
              </div>
              <div
                className="text-2xl font-bold text-jarvis-accent glow-accent tracking-[6px] select-all cursor-pointer"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(currentSession.pairing_code!)}
              >
                {currentSession.pairing_code}
              </div>
              <div className="text-[12px] opacity-30 mt-1">
                EXPIRES IN 5 MIN // CLICK TO COPY
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
