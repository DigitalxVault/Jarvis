'use client'

import { useEffect, useRef, useState, useCallback, startTransition } from 'react'
import { supabase } from '@/lib/supabase'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { FlightPhaseState } from '@/lib/flight-phases'
import type { ActiveAlert } from '@jarvis-dcs/shared'
import type { ConversationEntry } from '@jarvis-dcs/shared'

export interface LogEntry {
  id: string
  ts: number
  type: 'phase' | 'alert' | 'connection' | 'conversation-player' | 'conversation-jarvis'
  label: string
  severity?: 'info' | 'warning' | 'critical'
}

const MAX_ENTRIES = 500

/**
 * Accumulates trainer log entries from flight events and conversation broadcasts.
 *
 * Listens for:
 * - Connection state changes
 * - Flight phase transitions
 * - Active alert changes
 * - Conversation broadcast events from the player's voice pipeline
 *
 * Uses a DISTINCT channel name (`session:${sessionId}:trainer-log`) to avoid
 * conflicts with the useTelemetry subscription on the main session channel.
 */
export function useTrainerLog(
  sessionId: string,
  connectionState: ConnectionState,
  flightPhase: FlightPhaseState,
  alerts: ActiveAlert[],
): LogEntry[] {
  const [entries, setEntries] = useState<LogEntry[]>([])

  const appendEntry = useCallback((entry: Omit<LogEntry, 'id' | 'ts'>) => {
    startTransition(() => {
      setEntries(prev => {
        const newEntry: LogEntry = {
          id: crypto.randomUUID(),
          ts: Date.now(),
          ...entry,
        }
        const updated = [...prev, newEntry]
        return updated.length > MAX_ENTRIES ? updated.slice(updated.length - MAX_ENTRIES) : updated
      })
    })
  }, [])

  // Connection state watcher
  const prevConnectionRef = useRef<ConnectionState>(connectionState)
  useEffect(() => {
    const prev = prevConnectionRef.current
    prevConnectionRef.current = connectionState
    if (prev !== connectionState) {
      appendEntry({
        type: 'connection',
        label: `Connection: ${connectionState}`,
        severity: 'info',
      })
    }
  }, [connectionState, appendEntry])

  // Flight phase watcher
  useEffect(() => {
    if (flightPhase.justTransitioned) {
      appendEntry({
        type: 'phase',
        label: `Flight phase: ${flightPhase.phase}`,
        severity: 'info',
      })
    }
  }, [flightPhase.justTransitioned, flightPhase.phase, appendEntry])

  // Alert watcher — track newly-fired alerts via a ruleId set
  const seenAlertIdsRef = useRef<Set<string>>(new Set())
  useEffect(() => {
    const currentIds = new Set(alerts.map(a => a.ruleId))

    // Add new alerts not previously seen
    for (const alert of alerts) {
      if (!seenAlertIdsRef.current.has(alert.ruleId)) {
        seenAlertIdsRef.current.add(alert.ruleId)
        appendEntry({
          type: 'alert',
          label: alert.message,
          severity: alert.severity,
        })
      }
    }

    // Remove resolved alerts from the tracking set
    for (const seenId of seenAlertIdsRef.current) {
      if (!currentIds.has(seenId)) {
        seenAlertIdsRef.current.delete(seenId)
      }
    }
  }, [alerts, appendEntry])

  // Conversation watcher — subscribe to a DISTINCT channel to avoid
  // interfering with the useTelemetry subscription on the main channel.
  useEffect(() => {
    if (!sessionId) return

    const channelName = `session:${sessionId}:trainer-log`
    const channel = supabase.channel(channelName)

    channel
      .on('broadcast', { event: 'conversation' }, (payload) => {
        const entry = payload.payload as ConversationEntry
        if (!entry || entry.type !== 'conversation') return
        appendEntry({
          type: entry.role === 'player' ? 'conversation-player' : 'conversation-jarvis',
          label: entry.text,
          severity: 'info',
        })
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId, appendEntry])

  return entries
}
