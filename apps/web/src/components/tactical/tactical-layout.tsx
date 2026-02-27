'use client'

import { useTelemetryContext } from '@/providers/telemetry-provider'
import { TopBar } from '@/components/top-bar'
import { FuelGauge, EnginePanel, GMeter, AoAIndicator, VVITape } from '@/components/instruments'
import { TacticalHeader } from './tactical-header'
import { RadarScope } from './radar-scope'
import { WeaponsPanel } from './weapons-panel'

const formatSpeed = (mps: number | null) => mps !== null ? (mps * 1.94384).toFixed(0) : '---'
const formatAlt = (m: number | null) => m !== null ? (m * 3.28084).toFixed(0) : '---'
const formatMach = (mach: number | null) => mach !== null ? mach.toFixed(2) : '---'
const formatHdg = (rad: number | null) => rad !== null ? ((rad * 180 / Math.PI + 360) % 360).toFixed(0) : '---'
const formatG = (g: number | null) => g !== null ? g.toFixed(1) : '---'
const formatAoA = (rad: number | null) => rad !== null ? (rad * 180 / Math.PI).toFixed(1) : '---'
const formatVVI = (mps: number | null) => mps !== null ? (mps * 196.85).toFixed(0) : '---'

export function TacticalLayout() {
  const {
    telemetry,
    tactical,
    connectionState,
  } = useTelemetryContext()

  return (
    <div className="w-full h-screen flex flex-col">
      <TopBar connectionState={connectionState} />

      {/* TACT-02: 3-column layout */}
      <div className="flex-1 grid grid-cols-[220px_1fr_220px] min-h-0 bg-jarvis-bg">
        {/* TACT-03: Left panel — Systems */}
        <div className="bg-jarvis-bar border-r border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
          <FuelGauge
            internal={telemetry?.fuel?.internal ?? 0}
            external={telemetry?.fuel?.external ?? 0}
          />

          <EnginePanel
            rpmPct={telemetry?.eng?.rpm_pct ?? 0}
            fuelCon={telemetry?.eng?.fuel_con ?? 0}
          />

          {/* Mechanization status */}
          <div className="jarvis-panel p-1.5">
            <div className="panel-title">▸ SYSTEMS</div>
            <div className="flex flex-col gap-1 text-[11px] mt-1">
              <div className="flex justify-between">
                <span className="opacity-45">GEAR</span>
                <span className={
                  (tactical?.mech?.gear_status ?? 0) > 0.5
                    ? 'text-jarvis-success' : 'text-jarvis-muted'
                }>
                  {(tactical?.mech?.gear_status ?? 0) > 0.5 ? 'DOWN' : 'UP'}
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-45">FLAPS</span>
                <span className="text-jarvis-accent tabular-nums">
                  {Math.round((tactical?.mech?.flaps_value ?? 0) * 100)}%
                </span>
              </div>
              <div className="flex justify-between">
                <span className="opacity-45">SPD BRK</span>
                <span className={
                  (tactical?.mech?.speedbrakes ?? 0) > 0.1
                    ? 'text-jarvis-warning' : 'text-jarvis-muted'
                }>
                  {(tactical?.mech?.speedbrakes ?? 0) > 0.1 ? 'OPEN' : 'CLOSED'}
                </span>
              </div>
            </div>
          </div>

          {/* MCP Warnings */}
          {tactical?.mcp_warnings && tactical.mcp_warnings.length > 0 && (
            <div className="jarvis-panel p-1.5 border-jarvis-danger/40">
              <div className="panel-title text-jarvis-danger">▸ WARNINGS</div>
              <div className="flex flex-col gap-0.5 mt-1">
                {tactical.mcp_warnings.slice(0, 6).map((w) => (
                  <div key={w} className="text-[10px] text-jarvis-danger animate-blink" style={{ letterSpacing: '1px' }}>
                    ● {w.replace(/([A-Z])/g, ' $1').trim().toUpperCase()}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* TACT-05: Center panel — Tactical header + Radar + Weapons */}
        <div className="flex flex-col min-h-0 overflow-hidden"
          style={{ background: 'radial-gradient(ellipse at 50% 40%, #001020 0%, #010a1a 70%)' }}
        >
          {/* Tactical header */}
          <TacticalHeader
            tactical={tactical}
            connectionState={connectionState}
          />

          {/* Radar scope — takes remaining space */}
          <div className="flex-1 min-h-0 flex items-center justify-center p-2">
            <RadarScope
              telemetry={telemetry}
              tactical={tactical}
            />
          </div>

          {/* Weapons strip at bottom */}
          <WeaponsPanel tactical={tactical} />
        </div>

        {/* TACT-04: Right panel — Flight/Nav data */}
        <div className="bg-jarvis-bar border-l border-jarvis-border p-2 flex flex-col gap-2 overflow-hidden">
          <div className="jarvis-panel p-1.5">
            <div className="panel-title">▸ FLIGHT DATA</div>
            <div className="flex flex-col gap-1.5 mt-1">
              <FlightDataRow label="IAS" value={formatSpeed(telemetry?.spd?.ias_mps ?? null)} unit="KTS" />
              <FlightDataRow label="MACH" value={formatMach(telemetry?.spd?.mach ?? null)} />
              <FlightDataRow label="ALT MSL" value={formatAlt(telemetry?.pos?.alt_m ?? null)} unit="FT" />
              <FlightDataRow label="HDG" value={formatHdg(telemetry?.hdg_rad ?? null)} unit="°" />
              <FlightDataRow label="VVI" value={formatVVI(telemetry?.spd?.vvi_mps ?? null)} unit="FPM" />
              <FlightDataRow label="G-LOAD" value={formatG(telemetry?.aero?.g?.y ?? null)} unit="G" />
              <FlightDataRow label="AOA" value={formatAoA(telemetry?.aero?.aoa_rad ?? null)} unit="°" />
            </div>
          </div>

          {/* Compact instruments */}
          <GMeter gY={telemetry?.aero?.g?.y ?? 1} />
          <AoAIndicator aoaRad={telemetry?.aero?.aoa_rad ?? 0} />
          <VVITape vviMps={telemetry?.spd?.vvi_mps ?? 0} />
        </div>
      </div>
    </div>
  )
}

function FlightDataRow({ label, value, unit }: { label: string; value: string; unit?: string }) {
  return (
    <div className="flex justify-between items-baseline text-[11px]">
      <span className="opacity-45" style={{ letterSpacing: '1px' }}>{label}</span>
      <span className="text-jarvis-accent tabular-nums font-bold">
        {value}
        {unit && <span className="text-[9px] opacity-50 ml-1">{unit}</span>}
      </span>
    </div>
  )
}
