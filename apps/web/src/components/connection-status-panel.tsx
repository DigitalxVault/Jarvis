'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface ConnectionStatusPanelProps {
  connectionState: ConnectionState
  sessionId: string | null
  onCreateSession?: () => void
  isCreatingSession?: boolean
  sessionError?: string | null
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
  sessionId,
  onCreateSession,
  isCreatingSession,
  sessionError,
}: ConnectionStatusPanelProps) {
  const hadTelemetryRef = useRef<boolean>(false)
  const [trainerCode, setTrainerCode] = useState<string | null>(null)
  const [isGenerating, setIsGenerating] = useState(false)
  const [codeError, setCodeError] = useState<string | null>(null)
  const [observerLink, setObserverLink] = useState<string | null>(null)
  const [isGeneratingLink, setIsGeneratingLink] = useState(false)
  const [linkCopied, setLinkCopied] = useState(false)

  // Track whether we've ever received telemetry
  if (connectionState === 'connected') {
    hadTelemetryRef.current = true
  }

  // Reset trainer code + observer link when session changes
  useEffect(() => {
    setTrainerCode(null)
    setCodeError(null)
    setObserverLink(null)
    setLinkCopied(false)
  }, [sessionId])

  const handleGenerateCode = useCallback(async () => {
    if (!sessionId) return
    setIsGenerating(true)
    setCodeError(null)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/trainer-code`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      setTrainerCode(data.trainerCode)
    } catch (err) {
      setCodeError(err instanceof Error ? err.message : 'Failed to generate code')
    } finally {
      setIsGenerating(false)
    }
  }, [sessionId])

  const handleGenerateObserverLink = useCallback(async () => {
    if (!sessionId) return
    setIsGeneratingLink(true)
    try {
      const res = await fetch(`/api/sessions/${sessionId}/observer-link`, { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.error || `Failed (${res.status})`)
      }
      const data = await res.json()
      setObserverLink(data.url as string)
    } catch {
      // Silently handle — link section won't appear; no disruptive error for optional feature
    } finally {
      setIsGeneratingLink(false)
    }
  }, [sessionId])

  const handleCopyLink = useCallback(async () => {
    if (!observerLink) return
    try {
      await navigator.clipboard.writeText(observerLink)
      setLinkCopied(true)
      setTimeout(() => setLinkCopied(false), 2000)
    } catch {
      // Clipboard API not available
    }
  }, [observerLink])

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

        {/* Create session — shown when no session exists */}
        {!sessionId && onCreateSession && (
          <div className="border-t border-jarvis-border/40 pt-2">
            <div className="text-center">
              <button
                onClick={onCreateSession}
                disabled={isCreatingSession}
                className="w-full px-3 py-2 text-[11px] font-bold border border-jarvis-accent/60 text-jarvis-accent hover:border-jarvis-accent hover:bg-jarvis-accent/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                style={{ letterSpacing: '2px' }}
              >
                {isCreatingSession ? 'CREATING...' : 'CREATE SESSION'}
              </button>
              <div className="text-[9px] opacity-30 mt-1" style={{ letterSpacing: '1px' }}>
                ENABLES TRAINER MODE + CODES
              </div>
              {sessionError && (
                <div className="text-[10px] text-jarvis-danger mt-1" style={{ letterSpacing: '1px' }}>
                  {sessionError}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Trainer code generation — only when session is active */}
        {sessionId && (
          <div className="border-t border-jarvis-border/40 pt-2">
            {trainerCode ? (
              <div className="text-center animate-fade-in">
                <div className="text-[10px] opacity-40 font-bold mb-1" style={{ letterSpacing: '2px' }}>
                  TRAINER CODE
                </div>
                <div
                  className="text-[28px] font-bold text-jarvis-accent glow-accent tabular-nums"
                  style={{ letterSpacing: '8px', fontFamily: 'Courier New, monospace' }}
                >
                  {trainerCode}
                </div>
                <div className="text-[10px] opacity-30 mt-1" style={{ letterSpacing: '1px' }}>
                  SHARE WITH TRAINER
                </div>
                <button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="mt-1 text-[9px] opacity-30 hover:opacity-60 transition-opacity disabled:opacity-20"
                  style={{ letterSpacing: '1px' }}
                >
                  REGENERATE
                </button>
              </div>
            ) : (
              <div className="text-center">
                <button
                  onClick={handleGenerateCode}
                  disabled={isGenerating}
                  className="w-full px-3 py-1.5 text-[10px] font-bold border border-jarvis-primary/50 text-jarvis-primary hover:border-jarvis-accent hover:text-jarvis-accent transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ letterSpacing: '2px' }}
                >
                  {isGenerating ? 'GENERATING...' : 'GENERATE TRAINER CODE'}
                </button>
                {codeError && (
                  <div className="text-[10px] text-jarvis-danger mt-1" style={{ letterSpacing: '1px' }}>
                    {codeError}
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Observer link generation — shown when trainer code exists */}
        {sessionId && trainerCode && (
          <div className="border-t border-jarvis-border/40 pt-2" data-section="observer-link">
            {observerLink ? (
              <div className="text-center animate-fade-in">
                <div className="text-[9px] opacity-40 font-bold mb-1" style={{ letterSpacing: '2px' }}>
                  OBSERVER LINK
                </div>
                <div
                  className="text-jarvis-primary/60 mb-2 overflow-hidden text-ellipsis whitespace-nowrap"
                  style={{ fontSize: '8px', letterSpacing: '1px', maxWidth: '100%' }}
                  title={observerLink}
                >
                  {observerLink.replace(/^https?:\/\//, '')}
                </div>
                <button
                  onClick={handleCopyLink}
                  className="w-full px-3 py-1 text-[9px] font-bold border border-jarvis-accent/50 text-jarvis-accent hover:border-jarvis-accent hover:bg-jarvis-accent/10 transition-all"
                  style={{ letterSpacing: '2px' }}
                >
                  {linkCopied ? 'COPIED!' : 'COPY LINK'}
                </button>
                <div className="text-[8px] opacity-30 mt-1" style={{ letterSpacing: '1px' }}>
                  SHARE WITH OBSERVERS
                </div>
              </div>
            ) : (
              <div className="text-center">
                <button
                  onClick={handleGenerateObserverLink}
                  disabled={isGeneratingLink}
                  className="w-full px-3 py-1 text-[9px] font-bold border border-jarvis-primary/30 text-jarvis-primary/60 hover:border-jarvis-primary/60 hover:text-jarvis-primary transition-all disabled:opacity-40 disabled:cursor-not-allowed"
                  style={{ letterSpacing: '2px' }}
                >
                  {isGeneratingLink ? 'GENERATING...' : 'GENERATE OBSERVER LINK'}
                </button>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
