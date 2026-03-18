'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'

/**
 * Tracks all connected observers via Supabase Presence on channel `trainer-presence:<sessionId>`.
 * Returns the count of current observers (excludes the controller).
 *
 * Both controllers and observers call this hook to see live observer counts.
 */
export function useObserverPresence(
  sessionId: string,
  role: 'controller' | 'observer'
): number {
  const [observerCount, setObserverCount] = useState(0)
  // Stable unique key per client instance — observers get a UUID, controller gets fixed key
  const presenceKeyRef = useRef<string>(
    role === 'observer' ? crypto.randomUUID() : 'controller'
  )

  useEffect(() => {
    if (!sessionId) return

    const channelName = `trainer-presence:${sessionId}`
    const presenceKey = presenceKeyRef.current

    const channel = supabase.channel(channelName, {
      config: { presence: { key: presenceKey } },
    })

    function syncCount() {
      const state = channel.presenceState<{ role: string }>()
      let count = 0
      for (const entries of Object.values(state)) {
        for (const entry of entries) {
          if (entry.role === 'observer') count++
        }
      }
      setObserverCount(count)
    }

    channel
      .on('presence', { event: 'sync' }, syncCount)
      .on('presence', { event: 'join' }, syncCount)
      .on('presence', { event: 'leave' }, syncCount)
      .subscribe(async (status) => {
        if (status === 'SUBSCRIBED') {
          await channel.track({ role, joinedAt: new Date().toISOString() })
        }
      })

    return () => {
      channel.untrack().finally(() => {
        supabase.removeChannel(channel)
      })
    }
  }, [sessionId, role])

  return observerCount
}
