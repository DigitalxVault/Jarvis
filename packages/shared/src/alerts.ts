/** Alert severity levels */
export type AlertSeverity = 'info' | 'warning' | 'critical'

/** Single alert rule definition */
export interface AlertRule {
  id: string
  message: string
  severity: AlertSeverity
  /** Function that tests telemetry and returns true if alert should trigger */
  test: (telemetry: any) => boolean
  /** Optional: minimum duration (ms) before alert fires to prevent flicker */
  debounceMs?: number
}

/** Active alert state */
export interface ActiveAlert {
  ruleId: string
  message: string
  severity: AlertSeverity
  triggeredAt: number
}

/** Metadata for alert threshold configuration UI */
export interface AlertThresholdMeta {
  ruleId: string
  label: string
  unit: string
  min: number
  max: number
  step: number
  defaultValue: number
  /** Field path in telemetry used by the test function */
  telemetryField: string
}

export const ALERT_THRESHOLD_META: AlertThresholdMeta[] = [
  { ruleId: 'pull_up', label: 'PULL UP (AGL)', unit: 'ft', min: 50, max: 2000, step: 50, defaultValue: 500, telemetryField: 'pos.alt_agl_m' },
  { ruleId: 'over_g', label: 'OVER-G LIMIT', unit: 'G', min: 4, max: 12, step: 0.5, defaultValue: 9, telemetryField: 'aero.g.y' },
  { ruleId: 'stall', label: 'STALL AoA', unit: 'deg', min: 8, max: 25, step: 1, defaultValue: 15, telemetryField: 'aero.aoa_rad' },
  { ruleId: 'bingo_fuel', label: 'BINGO FUEL', unit: '%', min: 5, max: 50, step: 5, defaultValue: 30, telemetryField: 'fuel.internal' },
  { ruleId: 'low_speed', label: 'LOW SPEED', unit: 'kts', min: 80, max: 200, step: 10, defaultValue: 150, telemetryField: 'spd.ias_mps' },
  { ruleId: 'high_aoa', label: 'HIGH AoA', unit: 'deg', min: 5, max: 20, step: 1, defaultValue: 12.5, telemetryField: 'aero.aoa_rad' },
  { ruleId: 'negative_g', label: 'NEGATIVE G', unit: 'G', min: -3, max: 0, step: 0.5, defaultValue: -1, telemetryField: 'aero.g.y' },
]

/** F-16 default alert thresholds — configurable per aircraft type */
export const DEFAULT_ALERT_RULES: AlertRule[] = [
  {
    id: 'pull_up',
    message: '▲ PULL UP ▲',
    severity: 'critical',
    test: (t) => (t.pos?.alt_agl_m ?? 9999) < 152, // 500ft AGL
    debounceMs: 1000,
  },
  {
    id: 'over_g',
    message: '⚠ OVER-G WARNING',
    severity: 'critical',
    test: (t) => (t.aero?.g?.y ?? 0) > 9, // 9G limit
    debounceMs: 500,
  },
  {
    id: 'stall',
    message: '▲ STALL WARNING ▲',
    severity: 'critical',
    test: (t) => Math.abs(t.aero?.aoa_rad ?? 0) > 0.26, // ~15°
    debounceMs: 500,
  },
  {
    id: 'bingo_fuel',
    message: '⚠ BINGO FUEL',
    severity: 'warning',
    test: (t) => (t.fuel?.internal ?? 1) < 0.3, // 30%
    debounceMs: 2000,
  },
  {
    id: 'low_speed',
    message: '⚠ LOW SPEED',
    severity: 'warning',
    test: (t) => (t.spd?.ias_mps ?? 999) < 77, // ~150 knots
    debounceMs: 1500,
  },
  {
    id: 'high_aoa',
    message: 'HIGH ANGLE OF ATTACK',
    severity: 'warning',
    test: (t) => Math.abs(t.aero?.aoa_rad ?? 0) > 0.22, // ~12.5°
    debounceMs: 1000,
  },
  {
    id: 'negative_g',
    message: 'NEGATIVE G-FORCE',
    severity: 'warning',
    test: (t) => (t.aero?.g?.y ?? 1) < -1, // Below -1G
    debounceMs: 800,
  },
]
