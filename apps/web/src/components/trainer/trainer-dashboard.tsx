'use client'

import { useState, useCallback } from 'react'
import { useTelemetry } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useAlertConfig } from '@/hooks/use-alert-config'
import { useFlightPhase } from '@/hooks/use-flight-phase'
import { useCoaching } from '@/hooks/use-coaching'
import { useTrainerLog } from '@/hooks/use-trainer-log'
import { useObserverPresence } from '@/hooks/use-observer-presence'
import { TrainerTelemetryGrid } from './trainer-telemetry-grid'
import { TrainerTSD } from './trainer-tsd'
import { TrainerLogPanel } from './trainer-log-panel'
import { TrainerCommPanel } from './trainer-comm-panel'
import { ToastProvider } from '@/components/toast-notification'
import { TrainerRoleProvider } from './trainer-role-context'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface TrainerDashboardProps {
  sessionId: string
  role?: 'controller' | 'observer'
  onExit?: () => void
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

export function TrainerDashboard({ sessionId, role = 'controller', onExit }: TrainerDashboardProps) {
  // Call useTelemetry directly — NOT useTelemetryContext() — so the trainer
  // gets its own independent subscription to the player's session channel.
  const { telemetry, tactical, connectionState, sessionEnded } = useTelemetry(sessionId)
  const { rules: configuredRules } = useAlertConfig(sessionId)
  const { alerts, hasCritical, hasWarning } = useAlerts(telemetry, { rules: configuredRules })

  // TSD click-to-place: mission tab sets a handler; TrainerTSD uses it
  const [tsdClickHandler, setTsdClickHandlerState] = useState<((coords: { lat: number; lon: number }) => void) | null>(null)
  const setTsdClickHandler = useCallback(
    (handler: ((coords: { lat: number; lon: number }) => void) | null) => {
      setTsdClickHandlerState(() => handler)
    },
    []
  )
  const flightPhase = useFlightPhase(telemetry)
  // useCoaching must always be called unconditionally (React rules of hooks).
  // smoothness.score is passed to the Status card in TrainerTelemetryGrid.
  const { smoothness } = useCoaching(telemetry)

  const smoothnessScore = telemetry ? smoothness.score : null

  // Log accumulation — events from alerts/phases/connection/tactical + conversation from broadcast
  const logEntries = useTrainerLog(sessionId, connectionState, flightPhase, alerts, tactical)
  const observerCount = useObserverPresence(sessionId, role)

  return (
    <TrainerRoleProvider role={role}>
    <ToastProvider>
    <div className="relative">
    {/* SESSION ENDED overlay */}
    {sessionEnded && (
      <div
        className="fixed inset-0 z-[10000] flex items-center justify-center"
        style={{ background: 'rgba(1, 10, 26, 0.92)', fontFamily: 'Courier New, monospace' }}
      >
        <div
          className="jarvis-panel flex flex-col items-center gap-4 p-8"
          style={{ minWidth: '320px' }}
        >
          <div
            className="text-jarvis-accent"
            style={{ fontSize: '10px', letterSpacing: '4px', fontWeight: 'bold' }}
          >
            SESSION ENDED
          </div>
          <div
            style={{ fontSize: '9px', letterSpacing: '2px', color: 'rgba(0, 212, 255, 0.5)' }}
          >
            PILOT HAS ENDED THE SESSION
          </div>
          <button
            onClick={onExit}
            className="mt-2 px-6 py-2 border border-jarvis-accent text-jarvis-accent hover:bg-jarvis-accent/10 transition-all font-bold"
            style={{ fontSize: '9px', letterSpacing: '3px' }}
          >
            RETURN TO JOIN SCREEN
          </button>
        </div>
      </div>
    )}
    <div
      className="grid h-screen bg-jarvis-bg p-2 gap-2"
      style={{
        gridTemplateColumns: '280px 1fr 320px',
        gridTemplateRows: 'auto 1fr 340px',
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

        <div className="flex items-center gap-3">
          <div className="text-jarvis-primary/40" style={{ fontSize: '9px', letterSpacing: '2px' }}>
            SESSION {sessionId.slice(0, 8).toUpperCase()}
          </div>
          {role === 'observer' && (
            <span
              className="text-jarvis-warning font-bold"
              style={{ fontSize: '9px', letterSpacing: '2px' }}
            >
              OBSERVER
            </span>
          )}
          {observerCount > 0 && (
            <span style={{ fontSize: '8px', letterSpacing: '1px', color: 'rgba(0,212,255,0.4)' }}>
              {observerCount} OBSERVER{observerCount !== 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Awaiting telemetry banner — shown while connecting before first packet */}
      {(connectionState === 'connecting' || connectionState === 'offline') && !sessionEnded && (
        <div
          className="col-span-3 text-center text-jarvis-accent/40 animate-pulse"
          style={{ fontSize: '8px', letterSpacing: '3px', padding: '4px 0' }}
        >
          AWAITING TELEMETRY...
        </div>
      )}

      {/* Left column — telemetry grid (spans middle + bottom rows) */}
      <div className="overflow-auto" style={{ gridRow: '2 / 4' }}>
        <TrainerTelemetryGrid
          telemetry={telemetry}
          alerts={alerts}
          hasCritical={hasCritical}
          hasWarning={hasWarning}
          flightPhase={flightPhase}
          smoothnessScore={smoothnessScore}
        />
      </div>

      {/* Center column — Tactical Situation Display */}
      <div className="jarvis-panel flex flex-col min-h-0 p-1">
        <TrainerTSD
          telemetry={telemetry}
          tactical={tactical}
          onCanvasClick={tsdClickHandler ?? undefined}
        />
      </div>

      {/* Right column — mission log */}
      <div className="flex flex-col min-h-0 overflow-hidden">
        <TrainerLogPanel entries={logEntries} />
      </div>

      {/* Bottom row — comm panel spanning center + right columns */}
      <div className="col-span-2">
        <TrainerCommPanel
          sessionId={sessionId}
          telemetry={telemetry}
          flightPhase={flightPhase.phase}
          onSetTsdClickHandler={setTsdClickHandler}
        />
      </div>
    </div>
    </div>
    </ToastProvider>
    </TrainerRoleProvider>
  )
}
