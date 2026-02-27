'use client'

import { useTelemetryContext } from '@/providers/telemetry-provider'
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

const formatSpeed = (mps: number | null) => mps !== null ? (mps * 1.94384).toFixed(0) : '---'
const formatAlt = (m: number | null) => m !== null ? (m * 3.28084).toFixed(0) : '---'
const formatMach = (mach: number | null) => mach !== null ? mach.toFixed(2) : '---'
const formatTAS = (mps: number | null) => mps !== null ? (mps * 1.94384).toFixed(0) : '---'
const formatHdg = (rad: number | null) => rad !== null ? ((rad * 180 / Math.PI + 360) % 360).toFixed(0) : '---'

export function Dashboard() {
  const {
    currentSession,
    isCreating,
    sessionError,
    handleCreateSession,
    handleDevMode,
    clearSessionError,
    telemetry,
    connectionState,
    packetsPerSec,
    lastPacketAt,
    rawPackets,
    subscriptionStatus,
    alerts,
    hasCritical,
    hasWarning,
    coaching,
  } = useTelemetryContext()

  const sessionId = currentSession?.id ?? null

  return (
    <div className="w-full h-screen flex flex-col">
      {/* Top Bar — DASH-01: logo, nav, connection, clock only */}
      <TopBar connectionState={connectionState} />

      {/* Main content — DASH-02/03: 2-column, everything visible without scrolling */}
      <div className="flex-1 grid grid-cols-[260px_1fr] min-h-0 bg-jarvis-bg">
        {/* Left Panel — DASH-04: Session, ADI, Fuel, Engine */}
        <div className="bg-jarvis-bar border-r border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
          <SessionPanel
            currentSession={currentSession}
            connectionState={connectionState}
            onCreateSession={handleCreateSession}
            onDevMode={handleDevMode}
            isCreating={isCreating}
            sessionError={sessionError}
            onClearError={clearSessionError}
          />

          <div className="flex justify-center">
            <ADI
              pitchRad={telemetry?.att.pitch_rad ?? 0}
              bankRad={telemetry?.att.bank_rad ?? 0}
            />
          </div>

          <FuelGauge
            internal={telemetry?.fuel?.internal ?? 0}
            external={telemetry?.fuel?.external ?? 0}
          />

          <EnginePanel
            rpmPct={telemetry?.eng?.rpm_pct ?? 0}
            fuelCon={telemetry?.eng?.fuel_con ?? 0}
          />
        </div>

        {/* Center Panel — DASH-02/03: Flight data + instruments + debug */}
        <div className="relative flex flex-col min-h-0 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 55%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets */}
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          {/* Top: Mini telemetry cards */}
          <div className="flex justify-center gap-4 pt-3 px-4">
            <MiniTelemetryCard label="IND AIRSPEED" value={formatSpeed(telemetry?.spd?.ias_mps ?? null)} unit="KTS" color="accent" />
            <MiniTelemetryCard label="ALTITUDE" value={formatAlt(telemetry?.pos?.alt_m ?? null)} unit="FT" color="primary" />
            <MiniTelemetryCard label="HEADING" value={formatHdg(telemetry?.hdg_rad ?? null)} unit="°" color="accent" />
            <MiniTelemetryCard label="MACH NO" value={formatMach(telemetry?.spd?.mach ?? null)} color="success" />
            <MiniTelemetryCard label="TRUE AIRSPEED" value={formatTAS(telemetry?.spd?.tas_mps ?? null)} unit="KTS" color="accent" />
          </div>

          {/* Middle: Instruments row + JARVIS logo */}
          <div className="flex-1 flex items-center justify-center gap-6 px-4 min-h-0">
            <div className="flex-shrink-0">
              <GMeter gY={telemetry?.aero?.g?.y ?? 1} />
            </div>

            <div className="z-10">
              <JarvisLogo />
            </div>

            <div className="flex-shrink-0">
              <AoAIndicator aoaRad={telemetry?.aero?.aoa_rad ?? 0} />
            </div>

            <div className="flex-shrink-0">
              <VVITape vviMps={telemetry?.spd?.vvi_mps ?? 0} />
            </div>
          </div>

          {/* Alert overlay */}
          <div className="absolute bottom-28 left-1/2 -translate-x-1/2 w-full max-w-lg z-20">
            <AlertOverlay alerts={alerts} />
          </div>

          {/* Connection status */}
          {connectionState === 'connected' && !hasCritical && !hasWarning && (
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 text-[12px] text-jarvis-accent glow-accent animate-blink whitespace-nowrap z-10"
              style={{ letterSpacing: '2px' }}
            >
              ● SYSTEM NOMINAL
            </div>
          )}
          {connectionState === 'offline' && !currentSession && (
            <div
              className="absolute bottom-24 left-1/2 -translate-x-1/2 text-[12px] text-jarvis-muted whitespace-nowrap z-10"
              style={{ letterSpacing: '2px' }}
            >
              CREATE A SESSION TO BEGIN
            </div>
          )}

          {/* Bottom: Coaching + Debug row */}
          <div className="flex gap-2 px-4 pb-2 overflow-x-auto">
            <div className="flex-1 min-w-[200px]">
              <CoachingPanel
                speedBand={coaching.speedBand}
                altBand={coaching.altBand}
                headingTrack={coaching.headingTrack}
                smoothness={coaching.smoothness}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <DebugPanel
                packetsPerSec={packetsPerSec}
                lastPacketAt={lastPacketAt}
                sessionId={sessionId}
                subscriptionStatus={subscriptionStatus}
              />
            </div>
            <div className="flex-1 min-w-[200px]">
              <RawPacketViewer packets={rawPackets} />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <BottomBar connectionState={connectionState} telemetry={telemetry} />
    </div>
  )
}
