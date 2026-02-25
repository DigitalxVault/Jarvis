'use client'

import { useState, useCallback } from 'react'
import { useTelemetry } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useCoaching } from '@/hooks/use-coaching'
import { TopBar } from './top-bar'
import { BottomBar } from './bottom-bar'
import { SessionPanel } from './session-panel'
import { DebugPanel } from './debug-panel'
import { RawPacketViewer } from './raw-packet-viewer'
import { AlertOverlay } from './alert-overlay'
import { RadarDisplay } from './radar-display'
import { F16Silhouette } from './f16-silhouette'
import { ADI, FuelGauge, EnginePanel, GMeter, AoAIndicator, VVITape } from './instruments'
import { CoachingPanel } from './coaching-panel'
import type { Session } from '@jarvis-dcs/shared'

export function Dashboard() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isCreating, setIsCreating] = useState(false)

  const sessionId = currentSession?.id ?? null
  const {
    telemetry,
    connectionState,
    packetsPerSec,
    lastPacketAt,
    rawPackets,
    subscriptionStatus,
  } = useTelemetry(sessionId)

  // Safety alerts
  const { alerts, hasCritical, hasWarning } = useAlerts(telemetry)

  // Flight coaching
  const coaching = useCoaching(telemetry, {
    targetSpeedKnots: 350,
    speedTolerance: 50,
    targetAltFt: 25000,
    altTolerance: 200,
    targetHeadingDeg: 270,
    headingTolerance: 10,
  })

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (res.ok) {
        const session = await res.json()
        setCurrentSession(session)
      }
    } catch (err) {
      console.error('Failed to create session:', err)
    } finally {
      setIsCreating(false)
    }
  }, [])

  const handleDevMode = useCallback(() => {
    setCurrentSession({
      id: 'dev',
      user_id: 'dev',
      status: 'active',
      pairing_code: null,
      pairing_expires_at: null,
      bridge_claimed: true,
      created_at: new Date().toISOString(),
      ended_at: null,
    })
  }, [])

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top Bar */}
      <TopBar connectionState={connectionState} telemetry={telemetry} />

      {/* Main content */}
      <div className="flex-1 grid grid-cols-[260px_1fr_280px] min-h-0 bg-jarvis-bg">
        {/* Left Panel — Flight Instruments */}
        <div className="bg-jarvis-bar border-r border-jarvis-border p-3 flex flex-col gap-3 overflow-y-auto">
          {/* Session panel at top */}
          <SessionPanel
            currentSession={currentSession}
            connectionState={connectionState}
            onCreateSession={handleCreateSession}
            onDevMode={handleDevMode}
            isCreating={isCreating}
          />

          {/* ADI */}
          <div className="flex justify-center">
            <ADI
              pitchRad={telemetry?.att.pitch_rad ?? 0}
              bankRad={telemetry?.att.bank_rad ?? 0}
            />
          </div>

          {/* Fuel Gauge */}
          <FuelGauge
            internal={telemetry?.fuel?.internal ?? 0}
            external={telemetry?.fuel?.external ?? 0}
          />

          {/* Engine Panel */}
          <EnginePanel
            rpmPct={telemetry?.eng?.rpm_pct ?? 0}
            fuelCon={telemetry?.eng?.fuel_con ?? 0}
          />
        </div>

        {/* Center — Radar + Alerts */}
        <div className="relative flex items-center justify-center p-6"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets */}
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          {/* Radar display */}
          <div className="relative">
            <RadarDisplay />
            {/* F-16 silhouette overlay */}
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <F16Silhouette className="w-48 h-48 opacity-40" />
            </div>
          </div>

          {/* Alert overlay at bottom of center */}
          <div className="absolute bottom-8 left-1/2 -translate-x-1/2 w-full max-w-lg">
            <AlertOverlay alerts={alerts} />
          </div>

          {/* Connection status indicator */}
          {connectionState === 'connected' && !hasCritical && !hasWarning && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[12px] text-jarvis-accent glow-accent animate-blink whitespace-nowrap"
              style={{ letterSpacing: '2px' }}
            >
              ● SYSTEM NOMINAL
            </div>
          )}
          {connectionState === 'offline' && !currentSession && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[12px] text-jarvis-muted whitespace-nowrap"
              style={{ letterSpacing: '2px' }}
            >
              CREATE A SESSION TO BEGIN
            </div>
          )}
        </div>

        {/* Right Panel — Tactical Instruments */}
        <div className="bg-jarvis-bar border-l border-jarvis-border p-3 flex flex-col gap-3 overflow-y-auto">
          {/* G-Meter */}
          <GMeter gY={telemetry?.aero?.g?.y ?? 1} />

          {/* AoA Indicator */}
          <AoAIndicator aoaRad={telemetry?.aero?.aoa_rad ?? 0} />

          {/* VVI Tape */}
          <VVITape vviMps={telemetry?.spd?.vvi_mps ?? 0} />

          {/* Flight Coaching */}
          <CoachingPanel
            speedBand={coaching.speedBand}
            altBand={coaching.altBand}
            headingTrack={coaching.headingTrack}
            smoothness={coaching.smoothness}
          />

          {/* Debug Panel */}
          <DebugPanel
            packetsPerSec={packetsPerSec}
            lastPacketAt={lastPacketAt}
            sessionId={sessionId}
            subscriptionStatus={subscriptionStatus}
          />

          {/* Raw Packet Viewer */}
          <RawPacketViewer packets={rawPackets} />
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar connectionState={connectionState} telemetry={telemetry} />
    </div>
  )
}
