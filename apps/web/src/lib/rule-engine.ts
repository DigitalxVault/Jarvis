import type { TelemetryPacket } from '@jarvis-dcs/shared'

interface RuleResult {
  matched: boolean
  response: string
}

type RuleFn = (transcript: string, telemetry: TelemetryPacket | null) => RuleResult | null

// Unit conversion helpers
const mpsToKnots = (mps: number) => Math.round(mps * 1.94384)
const metresToFeet = (m: number) => Math.round(m * 3.28084)
const radToDeg = (rad: number) => Math.round(((rad * 180) / Math.PI + 360) % 360)
const mpsToFpm = (mps: number) => Math.round(mps * 196.85)

function fuelTimeEstimate(fuelFraction: number, fuelConKgS: number): string {
  if (fuelConKgS <= 0) return 'unknown endurance'
  const fuelKg = fuelFraction * 3200 // F-16C internal max
  const minutesLeft = (fuelKg / fuelConKgS) / 60
  if (minutesLeft < 60) return `approximately ${Math.round(minutesLeft)} minutes of fuel remaining`
  const hours = Math.floor(minutesLeft / 60)
  const mins = Math.round(minutesLeft % 60)
  return `approximately ${hours} hour${hours > 1 ? 's' : ''} ${mins} minutes of fuel remaining`
}

const rules: RuleFn[] = [
  // Altitude
  (t, tel) => {
    if (!/(altitude|how high|angels|alt\b)/i.test(t)) return null
    if (!tel?.pos) return { matched: true, response: 'Altitude data unavailable.' }
    const altFt = metresToFeet(tel.pos.alt_m)
    const aglFt = tel.pos.alt_agl_m ? metresToFeet(tel.pos.alt_agl_m) : null
    const agl = aglFt ? `, ${aglFt.toLocaleString()} feet above ground` : ''
    return { matched: true, response: `Current altitude ${altFt.toLocaleString()} feet${agl}.` }
  },

  // Airspeed
  (t, tel) => {
    if (!/(airspeed|speed|how fast|velocity|knots|ias\b)/i.test(t)) return null
    if (!tel?.spd) return { matched: true, response: 'Speed data unavailable.' }
    const ias = mpsToKnots(tel.spd.ias_mps)
    const mach = tel.spd.mach?.toFixed(2) ?? 'unknown'
    return { matched: true, response: `${ias} knots indicated, Mach ${mach}.` }
  },

  // Heading
  (t, tel) => {
    if (!/(heading|which direction|bearing|course|hdg\b)/i.test(t)) return null
    if (tel?.hdg_rad == null) return { matched: true, response: 'Heading data unavailable.' }
    const hdg = radToDeg(tel.hdg_rad)
    return { matched: true, response: `Heading ${hdg.toString().padStart(3, '0')} degrees.` }
  },

  // Fuel
  (t, tel) => {
    if (!/(fuel|gas|bingo|tank)/i.test(t)) return null
    if (!tel?.fuel) return { matched: true, response: 'Fuel data unavailable.' }
    const intPct = Math.round(tel.fuel.internal * 100)
    const extPct = Math.round(tel.fuel.external * 100)
    const timeEst = tel.eng?.fuel_con ? fuelTimeEstimate(tel.fuel.internal, tel.eng.fuel_con) : ''
    const ext = extPct > 0 ? ` External tanks at ${extPct}%.` : ''
    const time = timeEst ? ` ${timeEst}.` : ''
    return { matched: true, response: `Internal fuel ${intPct}%.${ext}${time}` }
  },

  // G-force
  (t, tel) => {
    if (!/(g.?force|g.?load|how many g|pulling)/i.test(t)) return null
    if (!tel?.aero?.g) return { matched: true, response: 'G-force data unavailable.' }
    return { matched: true, response: `Current G-load ${tel.aero.g.y.toFixed(1)} G.` }
  },

  // Angle of attack
  (t, tel) => {
    if (!/(angle of attack|aoa|alpha)/i.test(t)) return null
    if (!tel?.aero) return { matched: true, response: 'AoA data unavailable.' }
    const aoa = (tel.aero.aoa_rad * 180 / Math.PI).toFixed(1)
    return { matched: true, response: `Angle of attack ${aoa} degrees.` }
  },

  // Vertical speed
  (t, tel) => {
    if (!/(vertical speed|climb rate|descent rate|vvi|sink rate)/i.test(t)) return null
    if (!tel?.spd?.vvi_mps) return { matched: true, response: 'Vertical speed data unavailable.' }
    const fpm = mpsToFpm(tel.spd.vvi_mps)
    const dir = fpm > 50 ? 'climbing' : fpm < -50 ? 'descending' : 'level'
    return { matched: true, response: `${dir === 'level' ? 'Level flight' : (dir === 'climbing' ? 'Climbing' : 'Descending')}, ${Math.abs(fpm).toLocaleString()} feet per minute.` }
  },

  // Engine / RPM
  (t, tel) => {
    if (!/(engine|rpm|throttle|power)/i.test(t)) return null
    if (!tel?.eng) return { matched: true, response: 'Engine data unavailable.' }
    return { matched: true, response: `Engine at ${tel.eng.rpm_pct.toFixed(0)}% RPM.` }
  },

  // Systems status (general)
  (t, tel) => {
    if (!/(status|systems|how am i|sitrep|situation)/i.test(t)) return null
    if (!tel) return { matched: true, response: 'No telemetry available.' }
    const alt = tel.pos ? metresToFeet(tel.pos.alt_m).toLocaleString() : '---'
    const spd = tel.spd ? mpsToKnots(tel.spd.ias_mps) : '---'
    const hdg = tel.hdg_rad != null ? radToDeg(tel.hdg_rad).toString().padStart(3, '0') : '---'
    const fuel = tel.fuel ? Math.round(tel.fuel.internal * 100) : '---'
    const g = tel.aero?.g ? tel.aero.g.y.toFixed(1) : '---'
    return {
      matched: true,
      response: `Altitude ${alt} feet, ${spd} knots, heading ${hdg}, fuel ${fuel}%, ${g} G. All systems nominal.`,
    }
  },
]

/**
 * Try to match a voice transcript against known command patterns.
 * Returns a response string if matched, or null if no rule matched (falls through to GPT-4o).
 */
export function processWithRuleEngine(
  transcript: string,
  telemetry: TelemetryPacket | null
): string | null {
  for (const rule of rules) {
    const result = rule(transcript, telemetry)
    if (result?.matched) return result.response
  }
  return null
}
