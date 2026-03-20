'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'
import type { RealtimeChannel } from '@supabase/supabase-js'

export interface CoachingConfig {
  targetSpeedKnots: number
  speedTolerance: number
  targetAltFt: number
  altTolerance: number
  targetHeadingDeg: number
  headingTolerance: number
}

export const DEFAULT_COACHING_CONFIG: CoachingConfig = {
  targetSpeedKnots: 350,
  speedTolerance: 50,
  targetAltFt: 25000,
  altTolerance: 200,
  targetHeadingDeg: 270,
  headingTolerance: 10,
}

/**
 * Listens for `coaching_config` broadcast events on session:dev.
 * Returns the current coaching config (defaults until trainer overrides).
 */
export function useCoachingConfig(): CoachingConfig {
  const [config, setConfig] = useState<CoachingConfig>(DEFAULT_COACHING_CONFIG)

  useEffect(() => {
    const channelName = getChannelName('dev')
    const ch = supabase.channel(`${channelName}:coaching`, {
      config: { broadcast: { ack: false } },
    })

    ch.on('broadcast', { event: 'coaching_config' }, (msg) => {
      const payload = msg.payload as Partial<CoachingConfig>
      if (payload) {
        setConfig(prev => ({ ...prev, ...payload }))
      }
    })

    ch.subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  return config
}

/**
 * Broadcasts coaching config updates on session:dev.
 * Used by the trainer controls tab.
 */
export function useBroadcastCoachingConfig() {
  const channelRef = useRef<RealtimeChannel | null>(null)

  useEffect(() => {
    const channelName = getChannelName('dev')
    const ch = supabase.channel(`${channelName}:coaching-tx`, {
      config: { broadcast: { ack: false } },
    })
    ch.subscribe()
    channelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      channelRef.current = null
    }
  }, [])

  const broadcast = useCallback((config: CoachingConfig) => {
    channelRef.current?.send({
      type: 'broadcast',
      event: 'coaching_config',
      payload: config,
    })
  }, [])

  return broadcast
}
