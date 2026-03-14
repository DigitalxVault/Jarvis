'use client'

import { useState } from 'react'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import { TopBar } from './top-bar'
import { BottomBar } from './bottom-bar'
import { ConnectionStatusPanel } from './connection-status-panel'
import { DebugPanel } from './debug-panel'
import { RawPacketViewer } from './raw-packet-viewer'
import { AlertOverlay } from './alert-overlay'
import { JarvisLogo } from './jarvis-logo'
import { MiniTelemetryCard } from './mini-telemetry-card'
import { ADI, FuelGauge, EnginePanel, GMeter, AoAIndicator, VVITape } from './instruments'
import { CollapsibleWidget } from './collapsible-widget'
import type { CoachingBand, SmoothnessScore } from '@/hooks/use-coaching'
import type { ConnectionState } from '@/hooks/use-telemetry'

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
      <TopBar connectionState={connectionState} />

      {/* Main content — 3-column: left instruments | center HUD | right instruments */}
      <div className="flex-1 grid grid-cols-[240px_1fr_200px] min-h-0 bg-jarvis-bg">
        {/* Left Panel — Session, ADI, Fuel, Engine */}
        <div className="bg-jarvis-bar border-r border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
          <ConnectionStatusPanel
            currentSession={currentSession}
            connectionState={connectionState}
            onCreateSession={handleCreateSession}
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

          <CollapsibleWidget panelId="fuel" title="FUEL">
            <FuelGauge
              internal={telemetry?.fuel?.internal ?? 0}
              external={telemetry?.fuel?.external ?? 0}
            />
          </CollapsibleWidget>

          <CollapsibleWidget panelId="engine" title="ENGINE">
            <EnginePanel
              rpmPct={telemetry?.eng?.rpm_pct ?? 0}
              fuelCon={telemetry?.eng?.fuel_con ?? 0}
            />
          </CollapsibleWidget>
        </div>

        {/* Center Panel — HUD display */}
        <div className="relative flex flex-col min-h-0 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 45%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets */}
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />

          {/* Top: Mini telemetry cards */}
          <div className="flex justify-center gap-3 pt-3 px-4 flex-shrink-0">
            <MiniTelemetryCard label="IND AIRSPEED" value={formatSpeed(telemetry?.spd?.ias_mps ?? null)} unit="KTS" color="accent" />
            <MiniTelemetryCard label="ALTITUDE" value={formatAlt(telemetry?.pos?.alt_m ?? null)} unit="FT" color="primary" />
            <MiniTelemetryCard label="HEADING" value={formatHdg(telemetry?.hdg_rad ?? null)} unit="°" color="accent" />
            <MiniTelemetryCard label="MACH NO" value={formatMach(telemetry?.spd?.mach ?? null)} color="success" />
            <MiniTelemetryCard label="TRUE AIRSPEED" value={formatTAS(telemetry?.spd?.tas_mps ?? null)} unit="KTS" color="accent" />
          </div>

          {/* Center: JARVIS logo */}
          <div className="flex-1 flex items-center justify-center min-h-0">
            <JarvisLogo />
          </div>

          {/* Alert overlay */}
          <div className="absolute bottom-24 left-1/2 -translate-x-1/2 w-full max-w-lg z-20">
            <AlertOverlay alerts={alerts} />
          </div>

          {/* Status text — positioned above the coaching/debug bars */}
          {connectionState === 'connected' && !hasCritical && !hasWarning && (
            <div className="flex-shrink-0 text-center text-[12px] text-jarvis-accent glow-accent animate-blink whitespace-nowrap pb-1"
              style={{ letterSpacing: '2px' }}>
              ● SYSTEM NOMINAL
            </div>
          )}
          {/* Bottom: Coaching compact bar + Debug compact bar */}
          <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-1">
            <CompactCoaching
              speedBand={coaching.speedBand}
              altBand={coaching.altBand}
              headingTrack={coaching.headingTrack}
              smoothness={coaching.smoothness}
              connectionState={connectionState}
              hasSession={!!currentSession}
            />
            <CompactDebug
              packetsPerSec={packetsPerSec}
              lastPacketAt={lastPacketAt}
              sessionId={sessionId}
              subscriptionStatus={subscriptionStatus}
              rawPackets={rawPackets}
            />
          </div>
        </div>

        {/* Right Panel — G-Meter, AoA, VVI (compact, stacked) */}
        <div className="bg-jarvis-bar border-l border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
          <CollapsibleWidget panelId="g-meter" title="G-METER">
            <GMeter gY={telemetry?.aero?.g?.y ?? 1} />
          </CollapsibleWidget>

          <CollapsibleWidget panelId="aoa" title="ANGLE OF ATTACK">
            <AoAIndicator aoaRad={telemetry?.aero?.aoa_rad ?? 0} />
          </CollapsibleWidget>

          <CollapsibleWidget panelId="vvi" title="VERTICAL SPEED">
            <VVITape vviMps={telemetry?.spd?.vvi_mps ?? 0} />
          </CollapsibleWidget>
        </div>
      </div>

      <BottomBar connectionState={connectionState} telemetry={telemetry} />
    </div>
  )
}

/** Compact single-row coaching summary */
function CompactCoaching({
  speedBand, altBand, headingTrack, smoothness, connectionState, hasSession,
}: {
  speedBand: CoachingBand
  altBand: CoachingBand
  headingTrack: CoachingBand
  smoothness: SmoothnessScore
  connectionState: ConnectionState
  hasSession: boolean
}) {
  if (!hasSession) {
    return (
      <div className="bg-jarvis-panel/60 border border-jarvis-border/40 px-3 py-1.5 flex items-center gap-4 text-[12px]">
        <span className="opacity-40 font-bold" style={{ letterSpacing: '2px' }}>COACHING</span>
        <span className="opacity-40 ml-2" style={{ letterSpacing: '2px' }}>CREATE SESSION TO BEGIN</span>
      </div>
    )
  }

  if (connectionState !== 'connected') {
    return (
      <div className="bg-jarvis-panel/60 border border-jarvis-border/40 px-3 py-1.5 flex items-center gap-4 text-[12px]">
        <span className="opacity-40 font-bold" style={{ letterSpacing: '2px' }}>COACHING</span>
        <span className="text-jarvis-warning opacity-70 ml-2" style={{ letterSpacing: '2px' }}>AWAITING DCS LAUNCH</span>
      </div>
    )
  }

  return (
    <div className="bg-jarvis-panel/60 border border-jarvis-border/40 px-3 py-1.5 flex items-center gap-4 text-[12px]">
      <span className="opacity-40 font-bold" style={{ letterSpacing: '2px' }}>COACHING</span>
      <BandChip label="SPD" band={speedBand} unit="KT" />
      <BandChip label="ALT" band={altBand} unit="FT" />
      <BandChip label="HDG" band={headingTrack} unit="°" />
      <div className="flex items-center gap-1 ml-auto">
        <span className="opacity-40">SM</span>
        <span className={`font-bold tabular-nums ${
          smoothness.score >= 80 ? 'text-jarvis-success' : smoothness.score >= 50 ? 'text-jarvis-warning' : 'text-jarvis-danger'
        }`}>
          {smoothness.score}
        </span>
      </div>
    </div>
  )
}

function BandChip({ label, band, unit }: { label: string; band: CoachingBand; unit: string }) {
  const statusColor = band.status === 'in-band' ? 'text-jarvis-success'
    : band.status === 'no-data' ? 'text-jarvis-muted' : 'text-jarvis-warning'

  return (
    <div className="flex items-center gap-1">
      <span className="opacity-40">{label}</span>
      <span className={`font-bold tabular-nums ${statusColor}`}>
        {band.current !== null ? band.current.toFixed(0) : '---'}
      </span>
      <span className="opacity-30">/{band.target.toFixed(0)}{unit}</span>
    </div>
  )
}

/** Compact single-row debug info */
function CompactDebug({
  packetsPerSec, lastPacketAt, sessionId, subscriptionStatus, rawPackets,
}: {
  packetsPerSec: number
  lastPacketAt: number | null
  sessionId: string | null
  subscriptionStatus: string
  rawPackets: unknown[]
}) {
  const [showRaw, setShowRaw] = useState(false)

  return (
    <div className="bg-jarvis-panel/60 border border-jarvis-border/40 px-3 py-1.5 text-[12px]">
      <div className="flex items-center gap-4">
        <span className="opacity-40 font-bold" style={{ letterSpacing: '2px' }}>DEBUG</span>
        <span className="opacity-40">PPS</span>
        <span className="text-jarvis-accent tabular-nums font-bold">{packetsPerSec.toFixed(1)}</span>
        <span className="opacity-40">SES</span>
        <span className="text-jarvis-accent tabular-nums">{sessionId ? sessionId.slice(0, 8) : 'NONE'}</span>
        <span className="opacity-40">SUB</span>
        <span className="text-jarvis-accent tabular-nums">{subscriptionStatus}</span>
        <button
          onClick={() => setShowRaw(!showRaw)}
          className="ml-auto opacity-40 hover:opacity-100 cursor-pointer font-bold"
          style={{ letterSpacing: '1px' }}
        >
          RAW ({rawPackets.length}) {showRaw ? '▾' : '▸'}
        </button>
      </div>
      {showRaw && rawPackets.length > 0 && (
        <pre className="mt-1 text-[12px] opacity-30 max-h-24 overflow-y-auto whitespace-pre-wrap break-all">
          {JSON.stringify(rawPackets[rawPackets.length - 1], null, 2)}
        </pre>
      )}
    </div>
  )
}
