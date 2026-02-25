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
import { JarvisLogo } from './jarvis-logo'
import { MiniTelemetryCard } from './mini-telemetry-card'
import { ADI, FuelGauge, EnginePanel, GMeter, AoAIndicator, VVITape } from './instruments'
import { CoachingPanel } from './coaching-panel'
import type { Session } from '@jarvis-dcs/shared'

// Helper to format telemetry values
const formatSpeed = (mps: number | null) => mps !== null ? (mps * 1.94384).toFixed(0) : '---'
const formatAlt = (m: number | null) => m !== null ? (m * 3.28084).toFixed(0) : '---'
const formatVVI = (mps: number | null) => mps !== null ? (mps * 196.85).toFixed(0) : '---'
const formatMach = (mach: number | null) => mach !== null ? mach.toFixed(2) : '---'
const formatTAS = (mps: number | null) => mps !== null ? (mps * 1.94384).toFixed(0) : '---'
const formatG = (g: number | null) => g !== null ? g.toFixed(1) : '---'
const formatAoA = (rad: number | null) => rad !== null ? (rad * 180 / Math.PI).toFixed(1) : '---'
const formatHdg = (rad: number | null) => rad !== null ? ((rad * 180 / Math.PI + 360) % 360).toFixed(0) : '---'

export function Dashboard() {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

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
    setSessionError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Sign in with Google to create a session')
        }
        throw new Error(data.error || `Failed (${res.status})`)
      }
      const session = await res.json()
      setCurrentSession(session)
    } catch (err) {
      console.error('Failed to create session:', err)
      setSessionError(err instanceof Error ? err.message : 'Unknown error')
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
            sessionError={sessionError}
            onClearError={() => setSessionError(null)}
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

        {/* Center — JARVIS Logo + Mini Cards */}
        <div className="relative flex items-center justify-center p-6"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets */}
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          {/* Center layout: cards around JARVIS logo */}
          <div className="relative w-full h-full flex items-center justify-center">
            {/* Top row: IAS, ALT */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 flex gap-4">
              <MiniTelemetryCard
                label="IAS"
                value={formatSpeed(telemetry?.spd?.ias_mps ?? null)}
                unit="KTS"
                color="accent"
              />
              <MiniTelemetryCard
                label="ALT"
                value={formatAlt(telemetry?.pos?.alt_m ?? null)}
                unit="FT"
                color="primary"
              />
            </div>

            {/* Left column: G, AoA */}
            <div className="absolute left-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
              <MiniTelemetryCard
                label="G"
                value={formatG(telemetry?.aero?.g?.y ?? null)}
                color="success"
              />
              <MiniTelemetryCard
                label="AOA"
                value={formatAoA(telemetry?.aero?.aoa_rad ?? null)}
                unit="°"
                color="warning"
              />
            </div>

            {/* Right column: VVI, HDG */}
            <div className="absolute right-8 top-1/2 -translate-y-1/2 flex flex-col gap-4">
              <MiniTelemetryCard
                label="VVI"
                value={formatVVI(telemetry?.spd?.vvi_mps ?? null)}
                unit="FPM"
                color="primary"
              />
              <MiniTelemetryCard
                label="HDG"
                value={formatHdg(telemetry?.hdg_rad ?? null)}
                unit="°"
                color="accent"
              />
            </div>

            {/* Bottom row: Mach, TAS */}
            <div className="absolute bottom-16 left-1/2 -translate-x-1/2 flex gap-4">
              <MiniTelemetryCard
                label="MACH"
                value={formatMach(telemetry?.spd?.mach ?? null)}
                color="success"
              />
              <MiniTelemetryCard
                label="TAS"
                value={formatTAS(telemetry?.spd?.tas_mps ?? null)}
                unit="KTS"
                color="accent"
              />
            </div>

            {/* Center JARVIS logo */}
            <div className="z-10">
              <JarvisLogo />
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
