'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectionStatus } from './connection-status'
import { VoiceIndicator } from './voice-indicator'
import { FlightPhaseIndicator } from './flight-phase-indicator'
import { JarvisLogo } from './jarvis-logo'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface TopBarProps {
  connectionState: ConnectionState
  editMode?: boolean
  onToggleEditMode?: () => void
}

export function TopBar({ connectionState, editMode, onToggleEditMode }: TopBarProps) {
  const [clock, setClock] = useState('--:--:--')
  const [date, setDate] = useState('')
  const pathname = usePathname()
  const { currentSession } = useTelemetryContext()
  const sessionId = currentSession?.id ?? null
  const [isEnding, setIsEnding] = useState(false)

  const handleEndSession = useCallback(async () => {
    if (!sessionId) return
    const confirmed = window.confirm('End this session? Connected trainers will be disconnected.')
    if (!confirmed) return

    setIsEnding(true)
    try {
      // Broadcast session_ended to all channel subscribers first
      const channelName = getChannelName(sessionId)
      const ch = supabase.channel(channelName)
      await ch.send({
        type: 'broadcast',
        event: 'session_ended',
        payload: { type: 'session_ended', ts: Date.now() },
      })
      supabase.removeChannel(ch)

      // Then mark session as ended in DB
      await fetch(`/api/sessions/${sessionId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: 'ended' }),
      })
    } catch (err) {
      console.error('[TopBar] End session error:', err)
    } finally {
      setIsEnding(false)
    }
  }, [sessionId])

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toTimeString().slice(0, 8))
      setDate(now.toDateString().toUpperCase())
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  const isMainDash = pathname === '/'
  const isTactical = pathname === '/tactical'
  const isDocumentation = pathname === '/documentation'

  return (
    <div
      className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-3 md:px-6 h-[44px] md:h-[52px] relative z-50 safe-pl safe-pr safe-pt"
    >
      {/* Logo + Mini spinning reactor */}
      <div className="flex items-center gap-2">
        <JarvisLogo size={32} showText={false} />
        <div>
          <div className="text-[12px] md:text-[14px] font-bold glow-text" style={{ letterSpacing: '4px' }}>
            J·A·R·V·I·S
          </div>
          <div className="hidden md:block text-[12px] opacity-50" style={{ letterSpacing: '2px' }}>
            TACTICAL HUD v2.0
          </div>
        </div>
      </div>

      {/* Navigation — hidden on mobile */}
      <div className="hidden md:flex gap-2">
        <Link
          href="/"
          className={`px-4 py-1.5 text-[13px] font-bold border transition-all ${
            isMainDash
              ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
              : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
          }`}
          style={{ letterSpacing: '2px' }}
        >
          DASHBOARD
        </Link>
        <Link
          href="/tactical"
          className={`px-4 py-1.5 text-[13px] font-bold border transition-all ${
            isTactical
              ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
              : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
          }`}
          style={{ letterSpacing: '2px' }}
        >
          TACTICAL
        </Link>
        <Link
          href="/documentation"
          className={`px-4 py-1.5 text-[13px] font-bold border transition-all ${
            isDocumentation
              ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
              : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
          }`}
          style={{ letterSpacing: '2px' }}
        >
          DOCUMENTATION
        </Link>
      </div>

      {/* Status + Clock */}
      <div className="flex items-center gap-4">
        {onToggleEditMode && (
          <button
            onClick={onToggleEditMode}
            className={`hidden md:inline-flex px-3 py-1.5 text-[13px] font-bold border transition-all ${
              editMode
                ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
                : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
            }`}
            style={{ letterSpacing: '2px' }}
          >
            LAYOUT
          </button>
        )}
        {sessionId && (
          <button
            onClick={handleEndSession}
            disabled={isEnding}
            className="hidden md:inline-flex px-3 py-1.5 text-[8px] font-bold border border-jarvis-danger text-jarvis-danger hover:bg-jarvis-danger/10 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            style={{ letterSpacing: '2px' }}
          >
            {isEnding ? 'ENDING...' : 'END SESSION'}
          </button>
        )}
        <FlightPhaseIndicator />
        <VoiceIndicator />
        <ConnectionStatus state={connectionState} />
        <div className="text-right">
          <div className="text-lg font-bold glow-text tabular-nums">{clock}</div>
          <div className="hidden md:block text-[12px] opacity-50" style={{ letterSpacing: '1px' }}>{date}</div>
        </div>
      </div>
    </div>
  )
}
