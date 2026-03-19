'use client'

import type { TelemetryPacket } from '@jarvis-dcs/shared'
import type { ActiveAlert } from '@jarvis-dcs/shared'
import type { FlightPhaseState } from '@/lib/flight-phases'
import {
  mpsToKnots,
  metresToFeet,
  radToDeg,
  radToDegSigned,
  mpsToFpm,
} from '@/lib/conversions'

interface TrainerTelemetryGridProps {
  telemetry: TelemetryPacket | null
  alerts: ActiveAlert[]
  hasCritical: boolean
  hasWarning: boolean
  flightPhase: FlightPhaseState
  smoothnessScore: number | null
}

// Alert rule IDs mapped to the telemetry field labels they affect
const ALERT_FIELD_MAP: Record<string, string[]> = {
  pull_up: ['ALT'],
  over_g: ['G-LOAD'],
  stall: ['IAS', 'AOA'],
  bingo_fuel: ['FUEL'],
  low_fuel: ['FUEL'],
}

function getActiveRuleIds(alerts: ActiveAlert[]): string[] {
  return alerts.map((a) => a.ruleId)
}

function fieldAlertColor(
  fieldLabel: string,
  activeRuleIds: string[],
  hasCritical: boolean,
  hasWarning: boolean
): string {
  for (const ruleId of activeRuleIds) {
    const fields = ALERT_FIELD_MAP[ruleId] ?? []
    if (fields.includes(fieldLabel)) {
      // Determine severity of the alert that maps to this field
      if (hasCritical) return 'text-jarvis-danger'
      if (hasWarning) return 'text-jarvis-warning'
    }
  }
  return 'text-jarvis-primary'
}

function fmt(val: number | null | undefined, decimals = 0): string {
  if (val == null) return '---'
  return val.toFixed(decimals)
}

function fmtThousands(val: number | null | undefined, decimals = 0): string {
  if (val == null) return '---'
  return val.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  })
}

function fmtSign(val: number | null | undefined, decimals = 1): string {
  if (val == null) return '---'
  const sign = val >= 0 ? '+' : ''
  return `${sign}${val.toFixed(decimals)}`
}

function fmtDuration(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = Math.floor(seconds % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

interface CardProps {
  title: string
  children: React.ReactNode
}

function TelemetryCard({ title, children }: CardProps) {
  return (
    <div className="jarvis-panel">
      <div
        className="text-jarvis-accent mb-3"
        style={{ fontSize: '14px', letterSpacing: '3px' }}
      >
        {title}
      </div>
      <div className="space-y-2">{children}</div>
    </div>
  )
}

interface RowProps {
  label: string
  value: string
  unit?: string
  colorClass?: string
}

function TelemetryRow({ label, value, unit, colorClass = 'text-jarvis-primary' }: RowProps) {
  return (
    <div className="flex items-baseline justify-between">
      <span
        className="text-jarvis-primary/50"
        style={{ fontSize: '14px', letterSpacing: '2px', minWidth: '56px' }}
      >
        {label}
      </span>
      <div className="flex items-baseline gap-1">
        <span
          className={`${colorClass} tabular-nums`}
          style={{ fontSize: '22px', lineHeight: 1 }}
        >
          {value}
        </span>
        {unit && (
          <span
            className="text-jarvis-primary/40"
            style={{ fontSize: '14px', letterSpacing: '1px' }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

export function TrainerTelemetryGrid({
  telemetry,
  alerts,
  hasCritical,
  hasWarning,
  flightPhase,
  smoothnessScore,
}: TrainerTelemetryGridProps) {
  const activeRuleIds = getActiveRuleIds(alerts)

  function color(label: string): string {
    return fieldAlertColor(label, activeRuleIds, hasCritical, hasWarning)
  }

  // Core Flight values
  const altFt = telemetry ? metresToFeet(telemetry.pos.alt_m) : null
  const iasKts = telemetry ? mpsToKnots(telemetry.spd.ias_mps) : null
  const hdgDeg = telemetry ? radToDeg(telemetry.hdg_rad) : null
  const mach = telemetry?.spd.mach ?? null

  // Systems values
  const fuelPct = telemetry?.fuel != null ? (telemetry.fuel.internal ?? 0) * 100 : null
  const rpmPct = telemetry?.eng?.rpm_pct ?? null
  const gLoad = telemetry?.aero?.g?.y ?? null

  // Aero values
  const aoaDeg = telemetry?.aero != null ? radToDegSigned(telemetry.aero.aoa_rad) : null
  const vviFpm = telemetry?.spd.vvi_mps != null ? mpsToFpm(telemetry.spd.vvi_mps) : null
  const pitchDeg = telemetry ? radToDegSigned(telemetry.att.pitch_rad) : null
  const bankDeg = telemetry ? radToDegSigned(telemetry.att.bank_rad) : null

  return (
    <div className="flex flex-col gap-2">
      {/* Card 1 — Core Flight */}
      <TelemetryCard title="CORE FLIGHT">
        <TelemetryRow
          label="ALT"
          value={altFt != null ? fmtThousands(altFt) : '---'}
          unit="ft"
          colorClass={color('ALT')}
        />
        <TelemetryRow
          label="IAS"
          value={iasKts != null ? fmtThousands(iasKts) : '---'}
          unit="kts"
          colorClass={color('IAS')}
        />
        <TelemetryRow
          label="HDG"
          value={hdgDeg != null ? fmt(hdgDeg) : '---'}
          unit="°"
          colorClass="text-jarvis-primary"
        />
        <TelemetryRow
          label="MACH"
          value={mach != null ? mach.toFixed(2) : '---'}
          colorClass="text-jarvis-primary"
        />
      </TelemetryCard>

      {/* Card 2 — Systems */}
      <TelemetryCard title="SYSTEMS">
        <TelemetryRow
          label="FUEL"
          value={fuelPct != null ? fmt(fuelPct) : '---'}
          unit="%"
          colorClass={color('FUEL')}
        />
        <TelemetryRow
          label="RPM"
          value={rpmPct != null ? fmt(rpmPct) : '---'}
          unit="%"
          colorClass="text-jarvis-primary"
        />
        <TelemetryRow
          label="G-LOAD"
          value={gLoad != null ? fmtSign(gLoad, 1) : '---'}
          unit="G"
          colorClass={color('G-LOAD')}
        />
      </TelemetryCard>

      {/* Card 3 — Aero */}
      <TelemetryCard title="AERO">
        <TelemetryRow
          label="AOA"
          value={aoaDeg != null ? fmtSign(aoaDeg, 1) : '---'}
          unit="°"
          colorClass={color('AOA')}
        />
        <TelemetryRow
          label="VVI"
          value={vviFpm != null ? fmtSign(vviFpm, 0) : '---'}
          unit="fpm"
          colorClass="text-jarvis-primary"
        />
        <TelemetryRow
          label="PITCH"
          value={pitchDeg != null ? fmtSign(pitchDeg, 1) : '---'}
          unit="°"
          colorClass="text-jarvis-primary"
        />
        <TelemetryRow
          label="BANK"
          value={bankDeg != null ? fmtSign(bankDeg, 1) : '---'}
          unit="°"
          colorClass="text-jarvis-primary"
        />
      </TelemetryCard>

      {/* Card 4 — Status */}
      <TelemetryCard title="STATUS">
        <TelemetryRow
          label="PHASE"
          value={flightPhase.phase}
          colorClass="text-jarvis-accent"
        />
        <TelemetryRow
          label="DURATION"
          value={fmtDuration(flightPhase.phaseDuration)}
          colorClass="text-jarvis-primary/70"
        />
        <TelemetryRow
          label="SMOOTH"
          value={smoothnessScore != null ? fmt(smoothnessScore) : '---'}
          unit="%"
          colorClass={
            smoothnessScore == null
              ? 'text-jarvis-primary/30'
              : smoothnessScore >= 70
                ? 'text-jarvis-success'
                : smoothnessScore >= 40
                  ? 'text-jarvis-warning'
                  : 'text-jarvis-danger'
          }
        />
      </TelemetryCard>
    </div>
  )
}
