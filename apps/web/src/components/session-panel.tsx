'use client'

import type { Session } from '@jarvis-dcs/shared'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface SessionPanelProps {
  currentSession: Session | null
  connectionState: ConnectionState
  onCreateSession: () => void
  onDevMode: () => void
  isCreating: boolean
  sessionError: string | null
  onClearError: () => void
}

export function SessionPanel({
  currentSession,
  connectionState,
  onCreateSession,
  onDevMode,
  isCreating,
  sessionError,
  onClearError
}: SessionPanelProps) {
  return (
    <div className="jarvis-panel">
      <div className="panel-title">▸ SESSION</div>

      {!currentSession ? (
        <>
          <button
            onClick={onCreateSession}
            disabled={isCreating}
            className="w-full mt-2 border border-jarvis-border rounded px-3 py-2 text-[13px] font-bold tracking-[3px] text-jarvis-primary hover:bg-jarvis-primary/10 transition-colors disabled:opacity-30 cursor-pointer"
          >
            {isCreating ? 'CREATING...' : 'START SESSION'}
          </button>
          <button
            onClick={onDevMode}
            className="w-full mt-2 border border-jarvis-accent/40 rounded px-3 py-1.5 text-[11px] font-bold tracking-[3px] text-jarvis-accent hover:bg-jarvis-accent/10 transition-colors cursor-pointer"
          >
            DEV MODE
          </button>

          {/* Error display */}
          {sessionError && (
            <div className="mt-3 border border-jarvis-danger/50 rounded px-3 py-2 bg-jarvis-danger/10">
              <div className="flex justify-between items-start gap-2">
                <div className="flex-1">
                  <div className="text-[10px] text-jarvis-danger tracking-wider mb-1">ERROR</div>
                  <div className="text-[11px] text-jarvis-danger/90">{sessionError}</div>
                  <div className="text-[9px] opacity-40 mt-1">Use Dev Mode for testing</div>
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
          {/* Pairing Code */}
          {currentSession.pairing_code && !currentSession.bridge_claimed && (
            <div className="text-center">
              <div className="text-[11px] opacity-45 mb-1" style={{ letterSpacing: '2px' }}>
                PAIRING CODE
              </div>
              <div
                className="text-2xl font-bold text-jarvis-accent glow-accent tracking-[6px] select-all cursor-pointer"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(currentSession.pairing_code!)}
              >
                {currentSession.pairing_code}
              </div>
              <div className="text-[10px] opacity-30 mt-1">
                EXPIRES IN 5 MIN // CLICK TO COPY
              </div>
            </div>
          )}

          {/* Bridge / telemetry status */}
          {connectionState === 'connecting' && (
            <div className="text-center">
              <div className="text-[12px] text-jarvis-warning opacity-70">
                ◌ WAITING FOR BRIDGE
              </div>
            </div>
          )}
          {connectionState === 'dcs_offline' && (
            <div className="text-center">
              <div className="text-[12px] text-jarvis-success glow-success">
                ● BRIDGE ONLINE
              </div>
            </div>
          )}
          {connectionState === 'connected' && (
            <div className="text-center">
              <div className="text-[12px] text-jarvis-success glow-success animate-blink">
                ● TELEMETRY ACTIVE
              </div>
            </div>
          )}
          {connectionState === 'reconnecting' && (
            <div className="text-center">
              <div className="text-[12px] text-jarvis-warning opacity-70">
                ◌ RECONNECTING...
              </div>
            </div>
          )}

          {/* Session info */}
          <div className="flex flex-col gap-1 text-[11px]">
            <div className="flex justify-between">
              <span className="opacity-45">ID</span>
              <span className="opacity-60">{currentSession.id.slice(0, 8)}...</span>
            </div>
            <div className="flex justify-between">
              <span className="opacity-45">STATUS</span>
              <span className={
                currentSession.status === 'active'
                  ? 'text-jarvis-success'
                  : 'opacity-40'
              }>
                {currentSession.status.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
