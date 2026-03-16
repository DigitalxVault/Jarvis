'use client'

import { useEffect, useRef } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { ActiveAlert } from '@jarvis-dcs/shared'
import type { SpeechPriority } from '@/hooks/use-jarvis-tts'

/**
 * Triggers Jarvis voice cues on connection state changes and telemetry alerts.
 */
export function useVoiceCues(
  connectionState: ConnectionState,
  alerts: ActiveAlert[],
  speak: (text: string, priority: SpeechPriority) => void,
  enabled: boolean = true,
) {
  const prevConnectionRef = useRef<ConnectionState>(connectionState)
  const spokenAlertIds = useRef<Set<string>>(new Set())
  const hasGreeted = useRef(false)

  // Connection state voice cues
  useEffect(() => {
    if (!enabled) return
    const prev = prevConnectionRef.current
    prevConnectionRef.current = connectionState

    // Initial greeting on first connect
    if (!hasGreeted.current && connectionState === 'dcs_offline') {
      hasGreeted.current = true
      speak('JARVIS online. System initiated. Awaiting DCS launch.', 'P2')
      return
    }

    // State transitions
    if (prev === connectionState) return

    if (connectionState === 'connected' && prev !== 'connected') {
      speak('DCS connected. Telemetry stream active. Ready for your next flight.', 'P2')
    } else if (connectionState === 'dcs_offline' && prev === 'connected') {
      speak('DCS connection lost. Standing by for reconnect.', 'P2')
    } else if (connectionState === 'reconnecting') {
      speak('Reconnecting.', 'P3')
    }
  }, [connectionState, speak, enabled])

  // Alert voice cues
  useEffect(() => {
    if (!enabled) return

    for (const alert of alerts) {
      if (spokenAlertIds.current.has(alert.ruleId)) continue
      spokenAlertIds.current.add(alert.ruleId)

      const priority: SpeechPriority = alert.severity === 'critical' ? 'P1' : 'P2'

      // Map alert IDs to voice lines
      const lines: Record<string, string> = {
        pull_up: 'Warning. Low altitude. Pull up.',
        over_g: 'Caution. Excessive G-load.',
        stall: 'Warning. High angle of attack. Reduce pitch.',
        bingo_fuel: 'Caution. Bingo fuel. Consider return to base.',
        over_speed: 'Caution. Speed exceeding safe limits.',
        high_descent: 'Warning. High descent rate.',
        low_speed: 'Caution. Speed below safe margin.',
        bank_angle: 'Caution. Excessive bank angle.',
      }

      const line = lines[alert.ruleId] || `Alert. ${alert.ruleId.replace(/_/g, ' ')}.`
      speak(line, priority)
    }

    // Clean up spoken alerts that are no longer active
    const activeIds = new Set(alerts.map(a => a.ruleId))
    for (const id of spokenAlertIds.current) {
      if (!activeIds.has(id)) {
        spokenAlertIds.current.delete(id)
      }
    }
  }, [alerts, speak, enabled])
}
