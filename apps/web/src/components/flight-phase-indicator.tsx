'use client'

import { useTelemetryContext } from '@/providers/telemetry-provider'
import type { FlightPhase } from '@/lib/flight-phases'

const phaseConfigs: Record<FlightPhase, { color: string; label: string; icon: string }> = {
  PARKED:  { color: 'text-jarvis-muted', label: 'PARKED', icon: 'P' },
  STARTUP: { color: 'text-jarvis-warning', label: 'STARTUP', icon: 'S' },
  TAXI:    { color: 'text-jarvis-primary', label: 'TAXI', icon: 'T' },
  TAKEOFF: { color: 'text-jarvis-success', label: 'TAKEOFF', icon: '▲' },
  CRUISE:  { color: 'text-jarvis-accent', label: 'CRUISE', icon: '—' },
  COMBAT:  { color: 'text-jarvis-danger', label: 'COMBAT', icon: '✦' },
  LANDING: { color: 'text-jarvis-warning', label: 'LANDING', icon: '▼' },
}

/**
 * Shows current flight phase in the top bar.
 * Only visible when DCS is connected (has telemetry).
 */
export function FlightPhaseIndicator() {
  const { flightPhase, telemetry } = useTelemetryContext()

  // Don't render if no telemetry
  if (!telemetry) return null

  const config = phaseConfigs[flightPhase.phase]

  return (
    <div className="flex items-center gap-1.5" title={`Flight Phase: ${config.label}`}>
      <span className={`text-[13px] font-bold ${config.color}`}>
        {config.icon}
      </span>
      <span
        className={`hidden md:inline text-[11px] font-bold ${config.color}`}
        style={{ letterSpacing: '1px' }}
      >
        {config.label}
      </span>
    </div>
  )
}
