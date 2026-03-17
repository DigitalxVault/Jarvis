import type { TelemetryPacket } from '@jarvis-dcs/shared'

/**
 * Flight phases for F-16C — detected from telemetry patterns.
 *
 * STARTUP  → On ground, engines spooling up
 * TAXI     → On ground, moving slowly
 * TAKEOFF  → Accelerating on runway / just airborne, low altitude
 * CRUISE   → Stable flight, moderate speed, no aggressive maneuvering
 * COMBAT   → High-G, rapid heading changes, or high speed at low altitude
 * LANDING  → Descending, gear down (if mech data available), low speed approach
 * PARKED   → On ground, engines off or idle, no movement
 */
export type FlightPhase =
  | 'STARTUP'
  | 'TAXI'
  | 'TAKEOFF'
  | 'CRUISE'
  | 'COMBAT'
  | 'LANDING'
  | 'PARKED'

// Unit conversion helpers (SI → imperial for threshold checks)
const mpsToKnots = (mps: number) => mps * 1.94384
const metresToFeet = (m: number) => m * 3.28084

// Thresholds (F-16C specific)
const GROUND_ALT_AGL_M = 15       // < 50ft AGL = on ground
const TAXI_SPEED_KTS = 30          // < 30 kts = taxiing
const TAKEOFF_ALT_AGL_M = 305     // < 1000ft AGL after liftoff
const TAKEOFF_SPEED_KTS = 120     // min speed to be in takeoff phase
const LANDING_DESCENT_FPM = -400  // descending faster than 400 fpm
const LANDING_ALT_AGL_M = 915     // < 3000ft AGL
const LANDING_SPEED_KTS = 250     // < 250 kts on approach
const COMBAT_G_THRESHOLD = 4      // > 4G = maneuvering
const COMBAT_BANK_RAD = 0.785     // > 45° bank
const COMBAT_ANG_VEL_THRESHOLD = 0.3  // high angular velocity = dogfighting
const ENGINE_IDLE_RPM = 5         // < 5% RPM = engines off/idle

export interface FlightPhaseState {
  phase: FlightPhase
  /** Seconds in current phase */
  phaseDuration: number
  /** Previous phase (for transition detection) */
  previousPhase: FlightPhase | null
  /** Whether a phase transition just occurred */
  justTransitioned: boolean
}

interface PhaseDetectionContext {
  isOnGround: boolean
  speedKts: number
  altAglFt: number
  altMslFt: number
  gLoad: number
  bankRad: number
  vviFpm: number
  angVelMag: number
  rpmPct: number
}

function extractContext(t: TelemetryPacket): PhaseDetectionContext {
  const altAglM = t.pos?.alt_agl_m ?? t.pos?.alt_m ?? 0
  const speedMps = t.spd?.ias_mps ?? 0
  const vviMps = t.spd?.vvi_mps ?? 0
  const angVel = t.aero?.ang_vel

  return {
    isOnGround: altAglM < GROUND_ALT_AGL_M,
    speedKts: mpsToKnots(speedMps),
    altAglFt: metresToFeet(altAglM),
    altMslFt: metresToFeet(t.pos?.alt_m ?? 0),
    gLoad: Math.abs(t.aero?.g?.y ?? 1),
    bankRad: Math.abs(t.att?.bank_rad ?? 0),
    vviFpm: vviMps * 196.85,
    angVelMag: angVel
      ? Math.sqrt(angVel.x ** 2 + angVel.y ** 2 + angVel.z ** 2)
      : 0,
    rpmPct: t.eng?.rpm_pct ?? 0,
  }
}

/**
 * Detect current flight phase from telemetry.
 * Uses hysteresis: current phase has a slight "stickiness" to prevent
 * rapid oscillation between phases.
 */
export function detectFlightPhase(
  telemetry: TelemetryPacket,
  currentPhase: FlightPhase,
): FlightPhase {
  const ctx = extractContext(telemetry)

  // --- Ground phases ---
  if (ctx.isOnGround) {
    if (ctx.rpmPct < ENGINE_IDLE_RPM && ctx.speedKts < 5) {
      return 'PARKED'
    }
    if (ctx.speedKts < TAXI_SPEED_KTS) {
      // If we were in STARTUP and just started moving, stay STARTUP briefly
      if (currentPhase === 'PARKED' && ctx.rpmPct >= ENGINE_IDLE_RPM) {
        return 'STARTUP'
      }
      if (currentPhase === 'STARTUP' && ctx.speedKts < 10) {
        return 'STARTUP'
      }
      return 'TAXI'
    }
    // On ground but fast — takeoff roll
    if (ctx.speedKts >= TAKEOFF_SPEED_KTS) {
      return 'TAKEOFF'
    }
    return 'TAXI'
  }

  // --- Airborne phases ---

  // Just left the ground — takeoff
  if (ctx.altAglFt < metresToFeet(TAKEOFF_ALT_AGL_M) && ctx.vviFpm > 200) {
    // Stay in takeoff phase until above 1000ft AGL
    if (currentPhase === 'TAKEOFF' || currentPhase === 'TAXI') {
      return 'TAKEOFF'
    }
  }

  // Combat detection — high G, aggressive maneuvering
  if (
    ctx.gLoad > COMBAT_G_THRESHOLD ||
    ctx.bankRad > COMBAT_BANK_RAD ||
    ctx.angVelMag > COMBAT_ANG_VEL_THRESHOLD
  ) {
    return 'COMBAT'
  }

  // Landing detection — descending, low, slow
  if (
    ctx.altAglFt < metresToFeet(LANDING_ALT_AGL_M) &&
    ctx.vviFpm < LANDING_DESCENT_FPM &&
    ctx.speedKts < LANDING_SPEED_KTS
  ) {
    return 'LANDING'
  }

  // If currently landing and still in the approach envelope, stay in landing
  if (
    currentPhase === 'LANDING' &&
    ctx.altAglFt < metresToFeet(LANDING_ALT_AGL_M) &&
    ctx.speedKts < LANDING_SPEED_KTS
  ) {
    return 'LANDING'
  }

  // Default: cruise
  return 'CRUISE'
}
