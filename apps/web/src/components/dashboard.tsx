'use client'

import { useState, useEffect } from 'react'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import { usePanelPositions } from '@/hooks/use-panel-positions'
import { TopBar } from './top-bar'
import { BottomBar } from './bottom-bar'
import { ConnectionStatusPanel } from './connection-status-panel'
import { AlertOverlay } from './alert-overlay'
import { MiniTelemetryCard } from './mini-telemetry-card'
import { RadarScope } from './tactical/radar-scope'
import { ADI, FuelGauge, EnginePanel, GMeter, AoAIndicator, VVITape } from './instruments'
import { CollapsibleWidget } from './collapsible-widget'
import { DraggablePanel } from './draggable-panel'
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
    tactical,
    isNetworkOffline,
  } = useTelemetryContext()

  const isOffline = isNetworkOffline || telemetry === null

  const sessionId = currentSession?.id ?? null

  const [editMode, setEditMode] = useState(false)
  const { getOffset, updateOffset, resetAll, hasCustomPositions } = usePanelPositions()

  // Auto-clear edit mode when viewport shrinks below tablet breakpoint (768px)
  useEffect(() => {
    const mq = window.matchMedia('(min-width: 768px)')
    const handler = (e: MediaQueryListEvent) => {
      if (!e.matches) setEditMode(false)
    }
    // Clear on mount if already mobile
    if (!mq.matches) setEditMode(false)
    mq.addEventListener('change', handler)
    return () => mq.removeEventListener('change', handler)
  }, [])

  return (
    <div className="w-full h-screen flex flex-col">
      <TopBar
        connectionState={connectionState}
        editMode={editMode}
        onToggleEditMode={() => setEditMode(prev => !prev)}
      />

      {/* Edit mode toolbar — hidden on mobile */}
      {editMode && (
        <div className="bg-jarvis-bar border-b border-jarvis-accent/30 px-6 py-1.5 hidden md:flex items-center gap-4 z-40">
          <span className="text-[12px] text-jarvis-accent font-bold" style={{ letterSpacing: '2px' }}>
            EDIT MODE
          </span>
          <span className="text-[11px] text-jarvis-muted">
            Drag any panel to reposition
          </span>
          {hasCustomPositions && (
            <button
              onClick={() => {
                if (window.confirm('Reset all panels to default positions?')) {
                  resetAll()
                }
              }}
              className="ml-auto border border-jarvis-border text-jarvis-muted hover:border-jarvis-danger hover:text-jarvis-danger text-[11px] font-bold px-3 py-0.5 transition-all"
              style={{ letterSpacing: '2px' }}
            >
              RESET LAYOUT
            </button>
          )}
        </div>
      )}

      {/* Mobile-only mini telemetry strip */}
      <div className="md:hidden sticky top-0 z-30 bg-jarvis-bar border-b border-jarvis-border px-3 py-2 flex justify-between text-[13px]">
        <span><span className="opacity-40">IAS </span><span className="text-jarvis-accent tabular-nums font-bold">{formatSpeed(telemetry?.spd?.ias_mps ?? null)}</span></span>
        <span><span className="opacity-40">ALT </span><span className="text-jarvis-primary tabular-nums font-bold">{formatAlt(telemetry?.pos?.alt_m ?? null)}</span></span>
        <span><span className="opacity-40">HDG </span><span className="text-jarvis-accent tabular-nums font-bold">{formatHdg(telemetry?.hdg_rad ?? null)}</span></span>
        <span><span className="opacity-40">M </span><span className="text-jarvis-success tabular-nums font-bold">{formatMach(telemetry?.spd?.mach ?? null)}</span></span>
      </div>

      {/* Main content — flex-col on mobile, 3-column grid on tablet+ (md: = 768px) */}
      <div className="flex-1 flex flex-col md:grid md:grid-cols-[240px_1fr_200px] min-h-0 bg-jarvis-bg overflow-y-auto md:overflow-hidden">
        {/* Left Panel — Session, ADI, Fuel, Engine (hidden on mobile, shown on tablet+) */}
        <div className="hidden md:flex bg-jarvis-bar md:border-r border-jarvis-border p-1.5 flex-col gap-1 overflow-hidden">
          <DraggablePanel panelId="connection" editMode={editMode} offset={getOffset('connection')} onUpdateOffset={updateOffset}>
            <ConnectionStatusPanel
              connectionState={connectionState}
              sessionId={sessionId}
            />
          </DraggablePanel>

          <DraggablePanel panelId="adi" editMode={editMode} offset={getOffset('adi')} onUpdateOffset={updateOffset}>
            <div className="flex justify-center">
              <ADI
                pitchRad={telemetry?.att.pitch_rad ?? 0}
                bankRad={telemetry?.att.bank_rad ?? 0}
                isOffline={isOffline}
              />
            </div>
          </DraggablePanel>

          <DraggablePanel panelId="fuel" editMode={editMode} offset={getOffset('fuel')} onUpdateOffset={updateOffset}>
            <CollapsibleWidget panelId="fuel" title="FUEL" editMode={editMode}>
              <FuelGauge
                internal={telemetry?.fuel?.internal ?? 0}
                external={telemetry?.fuel?.external ?? 0}
              />
            </CollapsibleWidget>
          </DraggablePanel>

          <DraggablePanel panelId="engine" editMode={editMode} offset={getOffset('engine')} onUpdateOffset={updateOffset}>
            <CollapsibleWidget panelId="engine" title="ENGINE" editMode={editMode}>
              <EnginePanel
                rpmPct={telemetry?.eng?.rpm_pct ?? 0}
                fuelCon={telemetry?.eng?.fuel_con ?? 0}
                isOffline={isOffline}
              />
            </CollapsibleWidget>
          </DraggablePanel>
        </div>

        {/* Center Panel — HUD display */}
        <div className="relative flex flex-col min-h-0 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 45%, #001b3a 0%, #010a1a 65%)' }}
        >
          {/* Corner brackets — hidden on mobile (decorative) */}
          <div className="hidden md:block corner-bracket corner-tl" />
          <div className="hidden md:block corner-bracket corner-tr" />
          <div className="hidden md:block corner-bracket corner-bl" />
          <div className="hidden md:block corner-bracket corner-br" />

          {/* Top: Mini telemetry cards — hidden on mobile (mobile strip shown instead) */}
          <div className="hidden md:block">
            <DraggablePanel panelId="telemetry-cards" editMode={editMode} offset={getOffset('telemetry-cards')} onUpdateOffset={updateOffset}>
              <div className="flex justify-center gap-3 pt-3 pb-6 px-4 flex-shrink-0">
                <MiniTelemetryCard label="IND AIRSPEED" value={formatSpeed(telemetry?.spd?.ias_mps ?? null)} unit="KTS" color="accent" />
                <MiniTelemetryCard label="ALTITUDE" value={formatAlt(telemetry?.pos?.alt_m ?? null)} unit="FT" color="primary" />
                <MiniTelemetryCard label="HEADING" value={formatHdg(telemetry?.hdg_rad ?? null)} unit="°" color="accent" />
                <MiniTelemetryCard label="MACH NO" value={formatMach(telemetry?.spd?.mach ?? null)} color="success" />
                <MiniTelemetryCard label="TRUE AIRSPEED" value={formatTAS(telemetry?.spd?.tas_mps ?? null)} unit="KTS" color="accent" />
              </div>
            </DraggablePanel>
          </div>

          {/* Center: Radar scope — always visible */}
          <div className="flex-1 min-h-0 relative">
            <RadarScope telemetry={telemetry} tactical={tactical} />
          </div>

          {/* Alert overlay — compact banner on mobile, full overlay above coaching on desktop */}
          <div className="absolute bottom-2 md:bottom-24 left-1/2 -translate-x-1/2 w-full max-w-[calc(100%-1rem)] md:max-w-lg z-20 px-2 md:px-0">
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

        {/* Right Panel — G-Meter, AoA, VVI (hidden on mobile, shown on tablet+) */}
        <div className="hidden md:flex bg-jarvis-bar md:border-l border-jarvis-border p-1.5 flex-col gap-1 overflow-hidden">
          <DraggablePanel panelId="g-meter" editMode={editMode} offset={getOffset('g-meter')} onUpdateOffset={updateOffset}>
            <CollapsibleWidget panelId="g-meter" title="G-METER" editMode={editMode}>
              <GMeter gY={telemetry?.aero?.g?.y ?? 1} isOffline={isOffline} />
            </CollapsibleWidget>
          </DraggablePanel>

          <DraggablePanel panelId="aoa" editMode={editMode} offset={getOffset('aoa')} onUpdateOffset={updateOffset}>
            <CollapsibleWidget panelId="aoa" title="ANGLE OF ATTACK" editMode={editMode}>
              <AoAIndicator aoaRad={telemetry?.aero?.aoa_rad ?? 0} />
            </CollapsibleWidget>
          </DraggablePanel>

          <DraggablePanel panelId="vvi" editMode={editMode} offset={getOffset('vvi')} onUpdateOffset={updateOffset}>
            <CollapsibleWidget panelId="vvi" title="VERTICAL SPEED" editMode={editMode}>
              <VVITape vviMps={telemetry?.spd?.vvi_mps ?? 0} isOffline={isOffline} />
            </CollapsibleWidget>
          </DraggablePanel>
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
