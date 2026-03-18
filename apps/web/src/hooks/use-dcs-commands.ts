'use client'

import { useEffect, useRef, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'
import type {
  DcsCommandAction,
  DcsCommandResult,
  SpawnUnitPayload,
  SetAiTaskPayload,
  ConfigAlertPayload,
  InjectWaypointPayload,
} from '@jarvis-dcs/shared'

type CommandPayload =
  | SpawnUnitPayload
  | SetAiTaskPayload
  | ConfigAlertPayload
  | InjectWaypointPayload

interface PendingCommand {
  resolve: (result: DcsCommandResult) => void
  reject: (err: Error) => void
  timeout: ReturnType<typeof setTimeout>
}

const COMMAND_TIMEOUT_MS = 10_000

export interface UseDcsCommandsReturn {
  sendCommand: (action: DcsCommandAction, payload: CommandPayload) => Promise<DcsCommandResult>
}

/**
 * Hook to send DCS commands via Supabase Realtime broadcast and receive
 * correlated results. Commands are correlated by UUID and resolved via
 * a pending-command map with 10s timeout.
 */
export function useDcsCommands(sessionId: string): UseDcsCommandsReturn {
  const pendingRef = useRef<Map<string, PendingCommand>>(new Map())
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  useEffect(() => {
    if (!sessionId) return

    const channelName = getChannelName(sessionId)
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    })

    channel.on('broadcast', { event: 'dcs_command_result' }, (msg) => {
      const result = msg.payload as DcsCommandResult
      if (!result?.id) return

      const pending = pendingRef.current.get(result.id)
      if (pending) {
        clearTimeout(pending.timeout)
        pendingRef.current.delete(result.id)
        pending.resolve(result)
      }
    })

    channel.subscribe()
    channelRef.current = channel

    return () => {
      // Reject all pending commands on unmount
      const pending = pendingRef.current
      for (const [id, cmd] of pending.entries()) {
        clearTimeout(cmd.timeout)
        cmd.reject(new Error('Component unmounted'))
        pending.delete(id)
      }
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId])

  const sendCommand = useCallback(
    (action: DcsCommandAction, payload: CommandPayload): Promise<DcsCommandResult> => {
      return new Promise<DcsCommandResult>((resolve, reject) => {
        const channel = channelRef.current
        if (!channel) {
          reject(new Error('Channel not ready'))
          return
        }

        const id = crypto.randomUUID()

        const timeout = setTimeout(() => {
          pendingRef.current.delete(id)
          reject(new Error('Command timed out'))
        }, COMMAND_TIMEOUT_MS)

        pendingRef.current.set(id, { resolve, reject, timeout })

        channel.send({
          type: 'broadcast',
          event: 'dcs_command',
          payload: {
            type: 'dcs_command',
            id,
            action,
            payload,
          },
        })
      })
    },
    []
  )

  return { sendCommand }
}
