'use client'

import { useState, useCallback } from 'react'
import { useTelemetry } from '@/hooks/use-telemetry'
import { TopBar } from './top-bar'
import { BottomBar } from './bottom-bar'
import { TelemetryCard } from './telemetry-card'
import { SessionPanel } from './session-panel'
import { DebugPanel } from './debug-panel'
import { RawPacketViewer } from './raw-packet-viewer'
import type { Session } from '@jarvis-dcs/shared'

/** Convert m/s to knots */
function mpsToKnots(mps: number): number {
  return mps * 1.944
}

/** Convert metres to feet */
function metresToFeet(m: number): number {
  return m * 3.281
}

/** Convert radians to degrees (0-360) */
function radToDeg(rad: number): number {
  let deg = (rad * 57.2958) % 360
  if (deg < 0) deg += 360
  return deg
}

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

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top Bar */}
      <TopBar connectionState={connectionState} telemetry={telemetry} />

      {/* Main content */}
      <div className="flex-1 grid grid-cols-[230px_1fr_230px] min-h-0">
        {/* Left Panel — Session */}
        <div className="bg-jarvis-bar border-r border-jarvis-border p-4 flex flex-col gap-3 overflow-y-auto">
          <SessionPanel
            currentSession={currentSession}
            onCreateSession={handleCreateSession}
            isCreating={isCreating}
          />
        </div>

        {/* Center — Telemetry Cards */}
        <div className="flex items-center justify-center relative p-6"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets */}
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          <div className="grid grid-cols-3 gap-6 w-full max-w-3xl">
            <TelemetryCard
              label="INDICATED AIRSPEED"
              value={telemetry ? mpsToKnots(telemetry.spd.ias_mps) : null}
              unit="KNOTS"
              decimals={0}
              formatFn={(v) => Math.round(v).toString()}
            />
            <TelemetryCard
              label="ALTITUDE MSL"
              value={telemetry ? metresToFeet(telemetry.pos.alt_m) : null}
              unit="FEET"
              decimals={0}
              formatFn={(v) => Math.round(v).toLocaleString()}
            />
            <TelemetryCard
              label="MAGNETIC HEADING"
              value={telemetry ? radToDeg(telemetry.hdg_rad) : null}
              unit="DEGREES"
              decimals={0}
              formatFn={(v) => Math.round(v).toString().padStart(3, '0') + '°'}
            />
          </div>

          {/* Status alert */}
          {connectionState === 'connected' && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] text-jarvis-accent glow-accent animate-blink whitespace-nowrap"
              style={{ letterSpacing: '3px' }}
            >
              ● SYSTEM NOMINAL // TELEMETRY ACTIVE
            </div>
          )}
          {connectionState === 'offline' && !currentSession && (
            <div
              className="absolute bottom-8 left-1/2 -translate-x-1/2 text-[13px] text-jarvis-muted whitespace-nowrap"
              style={{ letterSpacing: '3px' }}
            >
              CREATE A SESSION TO BEGIN
            </div>
          )}
        </div>

        {/* Right Panel — Debug */}
        <div className="bg-jarvis-bar border-l border-jarvis-border p-4 flex flex-col gap-3 overflow-y-auto">
          <DebugPanel
            packetsPerSec={packetsPerSec}
            lastPacketAt={lastPacketAt}
            sessionId={sessionId}
            subscriptionStatus={subscriptionStatus}
          />
          <RawPacketViewer packets={rawPackets} />
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar connectionState={connectionState} />
    </div>
  )
}
