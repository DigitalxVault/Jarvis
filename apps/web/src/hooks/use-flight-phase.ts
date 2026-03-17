'use client'

import { useEffect, useRef, useState } from 'react'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { detectFlightPhase, type FlightPhase, type FlightPhaseState } from '@/lib/flight-phases'

/**
 * Hook that tracks the current flight phase based on telemetry data.
 * Includes phase duration tracking and transition detection.
 */
export function useFlightPhase(telemetry: TelemetryPacket | null): FlightPhaseState {
  const [state, setState] = useState<FlightPhaseState>({
    phase: 'PARKED',
    phaseDuration: 0,
    previousPhase: null,
    justTransitioned: false,
  })

  const phaseStartRef = useRef(Date.now())
  const currentPhaseRef = useRef<FlightPhase>('PARKED')
  const transitionCooldownRef = useRef(false)

  useEffect(() => {
    if (!telemetry) {
      // No telemetry — reset to PARKED
      if (currentPhaseRef.current !== 'PARKED') {
        const prevPhase = currentPhaseRef.current
        currentPhaseRef.current = 'PARKED'
        phaseStartRef.current = Date.now()
        setState({
          phase: 'PARKED',
          phaseDuration: 0,
          previousPhase: prevPhase,
          justTransitioned: true,
        })
      }
      return
    }

    const detected = detectFlightPhase(telemetry, currentPhaseRef.current)
    const now = Date.now()
    const duration = (now - phaseStartRef.current) / 1000

    if (detected !== currentPhaseRef.current) {
      // Phase changed — apply minimum dwell time (2s) to prevent flicker
      if (duration < 2 && !transitionCooldownRef.current) {
        // Too soon to transition, keep current phase but update duration
        setState(prev => ({
          ...prev,
          phaseDuration: duration,
          justTransitioned: false,
        }))
        return
      }

      const prevPhase = currentPhaseRef.current
      currentPhaseRef.current = detected
      phaseStartRef.current = now
      transitionCooldownRef.current = true

      // Reset cooldown after 3s
      setTimeout(() => {
        transitionCooldownRef.current = false
      }, 3000)

      setState({
        phase: detected,
        phaseDuration: 0,
        previousPhase: prevPhase,
        justTransitioned: true,
      })
    } else {
      setState(prev => ({
        ...prev,
        phaseDuration: duration,
        justTransitioned: false,
      }))
    }
  }, [telemetry])

  return state
}
