'use client'

import { useState } from 'react'
import type { Session } from '@jarvis-dcs/shared'

interface SessionPanelProps {
  currentSession: Session | null
  onCreateSession: () => void
  isCreating: boolean
}

export function SessionPanel({ currentSession, onCreateSession, isCreating }: SessionPanelProps) {
  return (
    <div className="jarvis-panel">
      <div className="panel-title">▸ SESSION</div>

      {!currentSession ? (
        <button
          onClick={onCreateSession}
          disabled={isCreating}
          className="w-full mt-2 border border-jarvis-border rounded px-3 py-2 text-[10px] font-bold tracking-[3px] text-jarvis-primary hover:bg-jarvis-primary/10 transition-colors disabled:opacity-30 cursor-pointer"
        >
          {isCreating ? 'CREATING...' : 'START SESSION'}
        </button>
      ) : (
        <div className="flex flex-col gap-3 mt-2">
          {/* Pairing Code */}
          {currentSession.pairing_code && !currentSession.bridge_claimed && (
            <div className="text-center">
              <div className="text-[8px] opacity-45 mb-1" style={{ letterSpacing: '2px' }}>
                PAIRING CODE
              </div>
              <div
                className="text-2xl font-bold text-jarvis-accent glow-accent tracking-[6px] select-all cursor-pointer"
                title="Click to copy"
                onClick={() => navigator.clipboard.writeText(currentSession.pairing_code!)}
              >
                {currentSession.pairing_code}
              </div>
              <div className="text-[7px] opacity-30 mt-1">
                EXPIRES IN 5 MIN // CLICK TO COPY
              </div>
            </div>
          )}

          {/* Bridge claimed */}
          {currentSession.bridge_claimed && (
            <div className="text-center">
              <div className="text-[9px] text-jarvis-success glow-success animate-blink">
                ● BRIDGE CONNECTED
              </div>
            </div>
          )}

          {/* Session info */}
          <div className="flex flex-col gap-1 text-[8px]">
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
