'use client'

import { useTelemetryContext } from '@/providers/telemetry-provider'
import { TopBar } from '@/components/top-bar'
import { BottomBar } from '@/components/bottom-bar'
import {
  mpsToKnots,
  metresToFeet,
  radToDeg,
  radToDegSigned,
  mpsToFpm,
  latToDMS,
  lonToDMS,
  formatHeading,
  metresToNM,
} from '@/lib/conversions'
import type { TelemetryPacket, TacticalPacket } from '@jarvis-dcs/shared'

// --- Helpers ---

function fmt(val: number | null | undefined, decimals = 1, suffix = ''): string {
  if (val == null) return '---'
  return `${val.toFixed(decimals)}${suffix}`
}

function fmtInt(val: number | null | undefined, suffix = ''): string {
  if (val == null) return '---'
  return `${Math.round(val)}${suffix}`
}

function pct(val: number | null | undefined): string {
  if (val == null) return '---'
  return `${(val * 100).toFixed(1)}%`
}

// --- Section builders ---

interface DataRow {
  label: string
  value: string
}

function getPositionRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'LATITUDE', value: t?.pos ? latToDMS(t.pos.lat) : '---' },
    { label: 'LONGITUDE', value: t?.pos ? lonToDMS(t.pos.lon) : '---' },
    { label: 'ALTITUDE MSL', value: t?.pos ? `${fmtInt(metresToFeet(t.pos.alt_m))} ft` : '---' },
    { label: 'ALTITUDE AGL', value: t?.pos?.alt_agl_m != null ? `${fmtInt(metresToFeet(t.pos.alt_agl_m))} ft` : '---' },
    { label: 'HEADING', value: t ? `${formatHeading(radToDeg(t.hdg_rad))}°` : '---' },
    { label: 'PITCH', value: t?.att ? `${fmt(radToDegSigned(t.att.pitch_rad))}°` : '---' },
    { label: 'BANK', value: t?.att ? `${fmt(radToDegSigned(t.att.bank_rad))}°` : '---' },
    { label: 'ANGLE OF ATTACK', value: t?.aero ? `${fmt(radToDegSigned(t.aero.aoa_rad))}°` : '---' },
  ]
}

function getVelocityRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'IAS', value: t?.spd ? `${fmtInt(mpsToKnots(t.spd.ias_mps))} kts` : '---' },
    { label: 'TAS', value: t?.spd?.tas_mps != null ? `${fmtInt(mpsToKnots(t.spd.tas_mps))} kts` : '---' },
    { label: 'MACH', value: t?.spd ? fmt(t.spd.mach, 2) : '---' },
    { label: 'VERTICAL VELOCITY', value: t?.spd?.vvi_mps != null ? `${fmtInt(mpsToFpm(t.spd.vvi_mps))} fpm` : '---' },
  ]
}

function getEngineRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'RPM', value: t?.eng ? `${fmt(t.eng.rpm_pct)}%` : '---' },
    { label: 'FUEL FLOW', value: t?.eng ? fmt(t.eng.fuel_con) : '---' },
  ]
}

function getFuelRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'INTERNAL', value: t?.fuel ? pct(t.fuel.internal) : '---' },
    { label: 'EXTERNAL', value: t?.fuel ? pct(t.fuel.external) : '---' },
  ]
}

function getGForceRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'G (NORMAL)', value: t?.aero ? fmt(t.aero.g.y) : '---' },
    { label: 'G (LATERAL)', value: t?.aero ? fmt(t.aero.g.x) : '---' },
    { label: 'G (LONGITUDINAL)', value: t?.aero ? fmt(t.aero.g.z) : '---' },
  ]
}

function getAngularVelocityRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'ROLL RATE', value: t?.aero ? `${fmt(radToDegSigned(t.aero.ang_vel.x))}°/s` : '---' },
    { label: 'PITCH RATE', value: t?.aero ? `${fmt(radToDegSigned(t.aero.ang_vel.y))}°/s` : '---' },
    { label: 'YAW RATE', value: t?.aero ? `${fmt(radToDegSigned(t.aero.ang_vel.z))}°/s` : '---' },
  ]
}

function getMechRows(tac: TacticalPacket | null): DataRow[] {
  const m = tac?.mech
  return [
    { label: 'GEAR', value: m ? (m.gear_status > 0.5 ? 'DOWN' : 'UP') : '---' },
    { label: 'FLAPS', value: m ? pct(m.flaps_value) : '---' },
    { label: 'SPEEDBRAKES', value: m ? pct(m.speedbrakes) : '---' },
  ]
}

function getWeaponsRows(tac: TacticalPacket | null): DataRow[] {
  const w = tac?.weapons
  if (!w) return [{ label: 'STATUS', value: '---' }]
  const rows: DataRow[] = [
    { label: 'CURRENT STATION', value: fmtInt(w.current_station) },
    { label: 'GUN ROUNDS', value: fmtInt(w.gun_rounds) },
  ]
  w.stations.forEach((s) => {
    rows.push({ label: `STN ${s.idx}: ${s.name}`, value: `x${s.count}` })
  })
  return rows
}

function getCountermeasuresRows(tac: TacticalPacket | null): DataRow[] {
  const c = tac?.countermeasures
  return [
    { label: 'CHAFF', value: c ? fmtInt(c.chaff) : '---' },
    { label: 'FLARE', value: c ? fmtInt(c.flare) : '---' },
  ]
}

function getNavRows(tac: TacticalPacket | null): DataRow[] {
  const n = tac?.nav
  return [
    { label: 'MASTER MODE', value: n?.master_mode ?? '---' },
    { label: 'SUB MODE', value: n?.sub_mode ?? '---' },
    { label: 'ACS MODE', value: n?.acs_mode ?? '---' },
    { label: 'AUTOTHRUST', value: n ? (n.autothrust ? 'ON' : 'OFF') : '---' },
    { label: 'CURRENT WP', value: n?.current_wp != null ? fmtInt(n.current_wp) : '---' },
  ]
}

function getRouteRows(tac: TacticalPacket | null): DataRow[] {
  const r = tac?.route
  if (!r || r.length === 0) return [{ label: 'WAYPOINTS', value: '---' }]
  return r.map((wp) => ({
    label: `WP ${wp.idx}: ${wp.name || 'UNNAMED'}`,
    value: `${latToDMS(wp.lat)} ${lonToDMS(wp.lon)} ${fmtInt(metresToFeet(wp.alt))} ft`,
  }))
}

function getTargetsRows(tac: TacticalPacket | null): DataRow[] {
  const targets = tac?.targets
  if (!targets || targets.length === 0) return [{ label: 'TARGETS', value: 'NONE' }]
  return targets.map((t, i) => ({
    label: `TGT ${i + 1} (ID: ${t.id})`,
    value: `${fmt(metresToNM(t.dist), 1)} NM  M${fmt(t.mach, 2)}  ${t.jamming ? 'JAM' : ''}`,
  }))
}

function getLockedRows(tac: TacticalPacket | null): DataRow[] {
  const locked = tac?.locked
  if (!locked || locked.length === 0) return [{ label: 'LOCKED', value: 'NONE' }]
  return locked.map((t, i) => ({
    label: `LOCK ${i + 1} (ID: ${t.id})`,
    value: `${fmt(metresToNM(t.dist), 1)} NM  M${fmt(t.mach, 2)}`,
  }))
}

function getObjectsRows(tac: TacticalPacket | null): DataRow[] {
  const objs = tac?.objects
  if (!objs || objs.length === 0) return [{ label: 'OBJECTS', value: 'NONE' }]
  return objs.map((o) => ({
    label: `${o.name} (${o.coal})`,
    value: `${latToDMS(o.lat)} ${lonToDMS(o.lon)} ${fmtInt(metresToFeet(o.alt))} ft`,
  }))
}

function getMiscRows(t: TelemetryPacket | null): DataRow[] {
  return [
    { label: 'MISSION TIME', value: t ? `${fmt(t.t_model, 1)} s` : '---' },
  ]
}

function getPermissionsRows(tac: TacticalPacket | null): DataRow[] {
  const p = tac?.permissions
  return [
    { label: 'OBJECTS', value: p ? (p.objects ? 'ALLOWED' : 'DENIED') : '---' },
    { label: 'SENSORS', value: p ? (p.sensors ? 'ALLOWED' : 'DENIED') : '---' },
  ]
}

function getWarningsRows(tac: TacticalPacket | null): DataRow[] {
  const w = tac?.mcp_warnings
  if (!w || w.length === 0) return [{ label: 'WARNINGS', value: 'NONE' }]
  return w.map((msg, i) => ({ label: `WARNING ${i + 1}`, value: msg }))
}

// --- Table component ---

function DataTable({ title, rows }: { title: string; rows: DataRow[] }) {
  return (
    <div className="jarvis-panel">
      <div
        className="text-[12px] text-jarvis-accent font-bold mb-2 pb-1 border-b border-jarvis-border"
        style={{ letterSpacing: '3px' }}
      >
        {title}
      </div>
      <table className="w-full text-[13px]">
        <tbody>
          {rows.map((row, i) => (
            <tr
              key={`${row.label}-${i}`}
              className={i % 2 === 0 ? 'bg-white/[0.02]' : ''}
            >
              <td className="py-1 pr-4 text-jarvis-muted whitespace-nowrap" style={{ letterSpacing: '1px' }}>
                {row.label}
              </td>
              <td className="py-1 text-right text-jarvis-primary font-bold tabular-nums">
                {row.value}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// --- Main layout ---

export function DocumentationLayout() {
  const {
    telemetry,
    tactical,
    connectionState,
  } = useTelemetryContext()

  return (
    <div className="w-full h-screen flex flex-col">
      <TopBar connectionState={connectionState} />

      <div className="flex-1 overflow-y-auto bg-jarvis-bg p-4">
          <div className="max-w-3xl mx-auto flex flex-col gap-3">
            <div
              className="text-[12px] text-jarvis-muted text-center mb-1"
              style={{ letterSpacing: '2px' }}
            >
              LIVE DCS DATA REFERENCE
            </div>

            {/* Flight Data */}
            <DataTable title="POSITION & ORIENTATION" rows={getPositionRows(telemetry)} />
            <DataTable title="VELOCITY" rows={getVelocityRows(telemetry)} />
            <DataTable title="ENGINE" rows={getEngineRows(telemetry)} />
            <DataTable title="FUEL" rows={getFuelRows(telemetry)} />
            <DataTable title="G-FORCES" rows={getGForceRows(telemetry)} />
            <DataTable title="ANGULAR VELOCITY" rows={getAngularVelocityRows(telemetry)} />
            <DataTable title="MISC" rows={getMiscRows(telemetry)} />

            {/* Tactical Data */}
            <DataTable title="MECHANIZATION" rows={getMechRows(tactical)} />
            <DataTable title="WEAPONS" rows={getWeaponsRows(tactical)} />
            <DataTable title="COUNTERMEASURES" rows={getCountermeasuresRows(tactical)} />
            <DataTable title="NAVIGATION" rows={getNavRows(tactical)} />
            <DataTable title="ROUTE / WAYPOINTS" rows={getRouteRows(tactical)} />
            <DataTable title="RADAR TARGETS" rows={getTargetsRows(tactical)} />
            <DataTable title="LOCKED TARGETS" rows={getLockedRows(tactical)} />
            <DataTable title="WORLD OBJECTS" rows={getObjectsRows(tactical)} />
            <DataTable title="SERVER PERMISSIONS" rows={getPermissionsRows(tactical)} />
            <DataTable title="MCP WARNINGS" rows={getWarningsRows(tactical)} />
          </div>
      </div>

      <BottomBar connectionState={connectionState} telemetry={telemetry} />
    </div>
  )
}
