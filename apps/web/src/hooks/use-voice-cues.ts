'use client'

import { useEffect, useRef } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { ActiveAlert } from '@jarvis-dcs/shared'
import type { SpeechPriority } from '@/hooks/use-jarvis-tts'
import type { FlightPhase } from '@/lib/flight-phases'
import { getPhaseAlertPrefix } from '@/lib/phase-personality'

/** Minimum seconds between repeated connection state voice cues.
 * 60s prevents spam when DCS is paused (pause stops Lua export,
 * triggering dcs_offline after 3s staleness; unpause resumes). */
const CONNECTION_CUE_COOLDOWN_S = 60
/** Minimum seconds between repeated alert voice cues for the same rule */
const ALERT_CUE_COOLDOWN_S = 30

/**
 * Triggers Jarvis voice cues on connection state changes and telemetry alerts.
 * Has cooldowns to prevent flip-flop spam when DCS pauses/resumes.
 */
export function useVoiceCues(
  connectionState: ConnectionState,
  alerts: ActiveAlert[],
  speak: (text: string, priority: SpeechPriority) => void,
  enabled: boolean = true,
  flightPhase: FlightPhase = 'CRUISE',
  onSpeak?: (text: string) => void,
) {
  const prevConnectionRef = useRef<ConnectionState>(connectionState)
  const hasGreeted = useRef(false)
  // Cooldown tracking: last time we spoke each cue type
  const lastConnectionCueAt = useRef<Record<string, number>>({})
  const lastAlertCueAt = useRef<Record<string, number>>({})

  // Connection state voice cues (with cooldown)
  useEffect(() => {
    if (!enabled) return
    const prev = prevConnectionRef.current
    prevConnectionRef.current = connectionState
    const now = Date.now() / 1000

    // Initial greeting on first connect
    if (!hasGreeted.current && (connectionState === 'dcs_offline' || connectionState === 'connected')) {
      hasGreeted.current = true
      if (connectionState === 'connected') {
        const greetingText = 'Good day sir. I\'m JARVIS, your AI co-pilot. I\'ll be monitoring your systems and providing guidance throughout your flight. Ready when you are.'
        speak(greetingText, 'P2')
        onSpeak?.(greetingText)
      } else {
        const greetingText = 'Good day sir. I\'m JARVIS, your AI co-pilot. Systems are online and I\'m standing by. I\'ll be right here when you launch your mission.'
        speak(greetingText, 'P2')
        onSpeak?.(greetingText)
      }
      lastConnectionCueAt.current['greeting'] = now
      return
    }

    // State transitions — skip if same or within cooldown
    if (prev === connectionState) return

    if (connectionState === 'connected' && prev !== 'connected') {
      const lastSpoke = lastConnectionCueAt.current['connected'] || 0
      if (now - lastSpoke < CONNECTION_CUE_COOLDOWN_S) return
      lastConnectionCueAt.current['connected'] = now
      const connectedText = 'DCS connected sir. Telemetry stream is active. Have a good flight.'
      speak(connectedText, 'P2')
      onSpeak?.(connectedText)
    } else if (connectionState === 'dcs_offline' && prev === 'connected') {
      const lastSpoke = lastConnectionCueAt.current['dcs_offline'] || 0
      if (now - lastSpoke < CONNECTION_CUE_COOLDOWN_S) return
      lastConnectionCueAt.current['dcs_offline'] = now
      const offlineText = 'DCS telemetry paused. Standing by sir.'
      speak(offlineText, 'P3')
      onSpeak?.(offlineText)
    }
    // Don't announce 'reconnecting' — too noisy
  }, [connectionState, speak, enabled, onSpeak])

  // Alert voice cues (with per-rule cooldown, friendly trainer style)
  useEffect(() => {
    if (!enabled) return
    const now = Date.now() / 1000

    for (const alert of alerts) {
      const lastSpoke = lastAlertCueAt.current[alert.ruleId] || 0
      if (now - lastSpoke < ALERT_CUE_COOLDOWN_S) continue
      lastAlertCueAt.current[alert.ruleId] = now

      const priority: SpeechPriority = alert.severity === 'critical' ? 'P1' : 'P2'

      const prefix = getPhaseAlertPrefix(flightPhase)

      // Phase-aware voice lines — terse in combat/landing, friendlier in cruise
      const combatLines: Record<string, string> = {
        pull_up: 'Pull up! Pull up!',
        over_g: 'Over-G! Ease off!',
        stall: 'Stall warning! Nose down!',
        bingo_fuel: 'Bingo fuel. RTB.',
        over_speed: 'Overspeed! Throttle back!',
        high_descent: 'High sink rate!',
        low_speed: 'Low speed! Add power!',
        bank_angle: 'Excessive bank!',
      }

      const normalLines: Record<string, string> = {
        pull_up: `${prefix}your altitude is critically low. Pull up immediately.`,
        over_g: `${prefix}you're pulling excessive G. Ease off the stick to stay within limits.`,
        stall: `${prefix}your angle of attack is getting high. Reduce pitch or add power to avoid a stall.`,
        bingo_fuel: `${prefix}you're at bingo fuel. I'd recommend heading back to base soon.`,
        over_speed: `${prefix}you're exceeding safe speed limits. Reduce throttle or pull back gently.`,
        high_descent: `${prefix}high descent rate. Level off when you can.`,
        low_speed: `Caution ${prefix.toLowerCase()}your airspeed is getting low. Consider adding power.`,
        bank_angle: `${prefix}your bank angle is quite steep. Level the wings slightly.`,
      }

      const lines = (flightPhase === 'COMBAT' || flightPhase === 'LANDING' || flightPhase === 'TAKEOFF')
        ? combatLines
        : normalLines

      const line = lines[alert.ruleId] || `${prefix}${alert.ruleId.replace(/_/g, ' ')} alert.`
      speak(line, priority)
      onSpeak?.(line)
    }
  }, [alerts, speak, enabled, onSpeak])
}
