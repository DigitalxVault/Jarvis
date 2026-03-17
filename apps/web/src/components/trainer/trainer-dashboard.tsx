'use client'

import { useTelemetry } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useFlightPhase } from '@/hooks/use-flight-phase'
import { useCoaching } from '@/hooks/use-coaching'
import { TrainerTelemetryGrid } from './trainer-telemetry-grid'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface TrainerDashboardProps {
  sessionId: string
}

function connectionDot(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'bg-jarvis-success'
    case 'connecting':
      return 'bg-jarvis-warning'
    case 'dcs_offline':
      return 'bg-jarvis-warning'
    case 'reconnecting':
      return 'bg-jarvis-danger animate-pulse'
    case 'offline':
    default:
      return 'bg-jarvis-primary/30'
  }
}

function connectionLabel(state: ConnectionState): string {
  switch (state) {
    case 'connected':
      return 'LIVE'
    case 'connecting':
      return 'CONNECTING'
    case 'dcs_offline':
      return 'DCS OFFLINE'
    case 'reconnecting':
      return 'RECONNECTING'
    case 'offline':
    default:
      return 'OFFLINE'
  }
}

export function TrainerDashboard({ sessionId }: TrainerDashboardProps) {
  // Call useTelemetry directly — NOT useTelemetryContext() — so the trainer
  // gets its own independent subscription to the player's session channel.
  const { telemetry, connectionState } = useTelemetry(sessionId)
  const { alerts, hasCritical, hasWarning } = useAlerts(telemetry)
  const flightPhase = useFlightPhase(telemetry)
  // useCoaching must always be called unconditionally (React rules of hooks).
  // smoothness.score is passed to the Status card in TrainerTelemetryGrid.
  const { smoothness } = useCoaching(telemetry)

  const smoothnessScore = telemetry ? smoothness.score : null

  return (
    <div
      className="grid h-screen bg-jarvis-bg p-2 gap-2"
      style={{
        gridTemplateColumns: '280px 1fr 260px',
        gridTemplateRows: 'auto 1fr',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Top bar — spans all columns */}
      <div
        className="col-span-3 jarvis-panel flex items-center justify-between"
        style={{ padding: '6px 12px' }}
      >
        <div className="text-jarvis-accent" style={{ fontSize: '10px', letterSpacing: '4px' }}>
          J·A·R·V·I·S // TRAINER VIEW
        </div>

        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${connectionDot(connectionState)}`} />
          <span
            className="text-jarvis-primary/70"
            style={{ fontSize: '9px', letterSpacing: '2px' }}
          >
            {connectionLabel(connectionState)}
          </span>
        </div>

        <div className="text-jarvis-primary/40" style={{ fontSize: '9px', letterSpacing: '2px' }}>
          SESSION {sessionId.slice(0, 8).toUpperCase()}
        </div>
      </div>

      {/* Left column — telemetry grid */}
      <div className="overflow-auto">
        <TrainerTelemetryGrid
          telemetry={telemetry}
          alerts={alerts}
          hasCritical={hasCritical}
          hasWarning={hasWarning}
          flightPhase={flightPhase}
          smoothnessScore={smoothnessScore}
        />
      </div>

      {/* Center column — TSD placeholder (Phase 21-02) */}
      <div className="jarvis-panel flex items-center justify-center">
        <div className="text-center">
          <div
            className="text-jarvis-primary/30"
            style={{ fontSize: '11px', letterSpacing: '3px' }}
          >
            TSD
          </div>
          <div
            className="text-jarvis-primary/20 mt-2"
            style={{ fontSize: '9px', letterSpacing: '2px' }}
          >
            PHASE 21-02
          </div>
        </div>
      </div>

      {/* Right column — logs placeholder (Phase 21-03) */}
      <div className="jarvis-panel flex items-center justify-center">
        <div className="text-center">
          <div
            className="text-jarvis-primary/30"
            style={{ fontSize: '11px', letterSpacing: '3px' }}
          >
            LOGS
          </div>
          <div
            className="text-jarvis-primary/20 mt-2"
            style={{ fontSize: '9px', letterSpacing: '2px' }}
          >
            PHASE 21-03
          </div>
        </div>
      </div>
    </div>
  )
}
