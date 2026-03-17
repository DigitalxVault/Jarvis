'use client'

import { useEffect, useRef, useState, useCallback, startTransition } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { FlightPhaseState } from '@/lib/flight-phases'
import type { ActiveAlert, TacticalPacket } from '@jarvis-dcs/shared'
import type { ConversationEntry } from '@jarvis-dcs/shared'

export interface LogEntry {
  id: string
  ts: number
  type: 'phase' | 'alert' | 'connection' | 'tactical' | 'conversation-player' | 'conversation-jarvis'
  label: string
  severity?: 'info' | 'warning' | 'critical'
}

const MAX_ENTRIES = 500

/**
 * Accumulates trainer log entries from flight events, tactical changes, and conversation broadcasts.
 *
 * Listens for:
 * - Connection state changes
 * - Flight phase transitions
 * - Active alert changes
 * - Weapons fired / countermeasures deployed (from tactical data diffing)
 * - Conversation broadcast events from the player's voice pipeline
 *
 * The conversation channel uses getChannelName(sessionId) to match the channel
 * that JarvisVoiceProvider broadcasts on. Supabase JS creates a new channel
 * object per supabase.channel() call, so this won't conflict with useTelemetry's
 * subscription on the same channel name.
 */
export function useTrainerLog(
  sessionId: string,
  connectionState: ConnectionState,
  flightPhase: FlightPhaseState,
  alerts: ActiveAlert[],
  tactical: TacticalPacket | null,
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

  // Tactical watcher — detect weapons fired and countermeasures deployed
  const prevWeaponsRef = useRef<{ totalWeapons: number; gunRounds: number; chaff: number; flare: number } | null>(null)
  useEffect(() => {
    if (!tactical) return

    const totalWeapons = tactical.weapons?.stations.reduce((sum, s) => sum + s.count, 0) ?? 0
    const gunRounds = tactical.weapons?.gun_rounds ?? 0
    const chaff = tactical.countermeasures?.chaff ?? 0
    const flare = tactical.countermeasures?.flare ?? 0

    const prev = prevWeaponsRef.current
    if (prev !== null) {
      if (totalWeapons < prev.totalWeapons) {
        appendEntry({
          type: 'tactical',
          label: `Weapon released (${prev.totalWeapons - totalWeapons} ordnance)`,
          severity: 'warning',
        })
      }
      if (gunRounds < prev.gunRounds) {
        appendEntry({
          type: 'tactical',
          label: `Gun fired (${prev.gunRounds - gunRounds} rounds)`,
          severity: 'info',
        })
      }
      if (chaff < prev.chaff) {
        appendEntry({
          type: 'tactical',
          label: `Chaff deployed (${prev.chaff - chaff})`,
          severity: 'info',
        })
      }
      if (flare < prev.flare) {
        appendEntry({
          type: 'tactical',
          label: `Flare deployed (${prev.flare - flare})`,
          severity: 'info',
        })
      }
    }
    prevWeaponsRef.current = { totalWeapons, gunRounds, chaff, flare }
  }, [tactical, appendEntry])

  // Conversation watcher — subscribe to the same channel JarvisVoiceProvider
  // broadcasts on. Supabase JS creates a distinct channel object per call,
  // so this won't conflict with useTelemetry's subscription.
  useEffect(() => {
    if (!sessionId) return

    const channelName = getChannelName(sessionId)
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
