import type { TelemetryPacket } from '@jarvis-dcs/shared'

export type TemplateCategory = 'SA' | 'Approach' | 'Combat' | 'Mission' | 'Encouragement'

export interface TrainerTemplate {
  id: string
  category: TemplateCategory
  label: string       // Short button label (displayed on button)
  template: string    // Text with placeholders: {ALT}, {SPEED}, {HEADING}, {FUEL}, {MACH}, {G}, {PHASE}
  isCustom?: boolean  // true for user-created templates
}

export const TEMPLATE_CATEGORIES: TemplateCategory[] = [
  'SA',
  'Approach',
  'Combat',
  'Mission',
  'Encouragement',
]

export const CURATED_TEMPLATES: TrainerTemplate[] = [
  // SA — Situational Awareness
  {
    id: 'sa-1',
    category: 'SA',
    label: 'CHECK ALTITUDE',
    template: 'Check your altitude, currently at {ALT}',
  },
  {
    id: 'sa-2',
    category: 'SA',
    label: 'VERIFY HEADING',
    template: 'Verify heading, you\'re tracking {HEADING}',
  },
  {
    id: 'sa-3',
    category: 'SA',
    label: 'SPEED CHECK',
    template: 'Speed check, showing {SPEED}',
  },
  {
    id: 'sa-4',
    category: 'SA',
    label: 'FUEL STATE',
    template: 'Check fuel state, you have {FUEL} remaining',
  },
  {
    id: 'sa-5',
    category: 'SA',
    label: 'FULL STATUS',
    template: 'Current state: {ALT}, {SPEED}, heading {HEADING}, {FUEL} fuel',
  },

  // Approach
  {
    id: 'app-1',
    category: 'Approach',
    label: 'ON GLIDESLOPE',
    template: 'Looking good on glideslope, maintain current descent rate',
  },
  {
    id: 'app-2',
    category: 'Approach',
    label: 'CHECK SPEED',
    template: 'Watch your approach speed, currently {SPEED}',
  },
  {
    id: 'app-3',
    category: 'Approach',
    label: 'TOO HIGH',
    template: 'You\'re high on approach at {ALT}, increase descent rate',
  },
  {
    id: 'app-4',
    category: 'Approach',
    label: 'TOO FAST',
    template: 'Reduce speed on approach, you\'re at {SPEED}',
  },
  {
    id: 'app-5',
    category: 'Approach',
    label: 'CLEARED TO LAND',
    template: 'Cleared to land, looking good',
  },

  // Combat
  {
    id: 'cbt-1',
    category: 'Combat',
    label: 'BREAK LEFT',
    template: 'Break left now',
  },
  {
    id: 'cbt-2',
    category: 'Combat',
    label: 'BREAK RIGHT',
    template: 'Break right now',
  },
  {
    id: 'cbt-3',
    category: 'Combat',
    label: 'EXTEND',
    template: 'Extend and separate, get some distance',
  },
  {
    id: 'cbt-4',
    category: 'Combat',
    label: 'CHECK SIX',
    template: 'Check your six, heads on a swivel',
  },
  {
    id: 'cbt-5',
    category: 'Combat',
    label: 'GUNS GUNS',
    template: 'Guns range, take the shot',
  },

  // Mission
  {
    id: 'msn-1',
    category: 'Mission',
    label: 'RTB',
    template: 'Time to RTB, return to base',
  },
  {
    id: 'msn-2',
    category: 'Mission',
    label: 'NEXT WAYPOINT',
    template: 'Proceed to next waypoint, heading {HEADING}',
  },
  {
    id: 'msn-3',
    category: 'Mission',
    label: 'HOLD POSITION',
    template: 'Hold current position at {ALT}',
  },
  {
    id: 'msn-4',
    category: 'Mission',
    label: 'CLIMB',
    template: 'Climb to assigned altitude, currently at {ALT}',
  },
  {
    id: 'msn-5',
    category: 'Mission',
    label: 'DESCEND',
    template: 'Descend to assigned altitude, currently at {ALT}',
  },

  // Encouragement
  {
    id: 'enc-1',
    category: 'Encouragement',
    label: 'GOOD WORK',
    template: 'Nice flying, keep it up',
  },
  {
    id: 'enc-2',
    category: 'Encouragement',
    label: 'SMOOTH FLYING',
    template: 'Very smooth flying, well done',
  },
  {
    id: 'enc-3',
    category: 'Encouragement',
    label: 'STAY FOCUSED',
    template: 'Stay focused, you\'re doing well',
  },
  {
    id: 'enc-4',
    category: 'Encouragement',
    label: 'GOOD KILL',
    template: 'Good kill, excellent shot',
  },
  {
    id: 'enc-5',
    category: 'Encouragement',
    label: 'NICE RECOVERY',
    template: 'Nice recovery, well handled',
  },
]

/**
 * Fill template placeholders with live telemetry data.
 * Falls back to readable "unknown" strings when telemetry is null or fields are missing.
 */
export function fillTemplate(template: string, telemetry: TelemetryPacket | null): string {
  const altFeet = telemetry?.pos?.alt_m != null
    ? Math.round(telemetry.pos.alt_m * 3.28084).toLocaleString() + ' feet'
    : 'altitude unknown'

  const speedKnots = telemetry?.spd?.ias_mps != null
    ? Math.round(telemetry.spd.ias_mps * 1.94384) + ' knots'
    : 'speed unknown'

  const headingDeg = telemetry?.hdg_rad != null
    ? String(Math.round(((telemetry.hdg_rad * 180 / Math.PI) + 360) % 360))
    : 'heading unknown'

  const fuelPct = telemetry?.fuel?.internal != null
    ? Math.round(telemetry.fuel.internal * 100) + '%'
    : 'fuel unknown'

  const mach = telemetry?.spd?.mach != null
    ? telemetry.spd.mach.toFixed(2)
    : 'Mach unknown'

  const gLoad = telemetry?.aero?.g?.y != null
    ? telemetry.aero.g.y.toFixed(1) + 'G'
    : 'G unknown'

  // {PHASE} — not currently in TelemetryPacket; placeholder reserved for future use
  const phase = 'phase unknown'

  return template
    .replace(/\{ALT\}/g, altFeet)
    .replace(/\{SPEED\}/g, speedKnots)
    .replace(/\{HEADING\}/g, headingDeg)
    .replace(/\{FUEL\}/g, fuelPct)
    .replace(/\{MACH\}/g, mach)
    .replace(/\{G\}/g, gLoad)
    .replace(/\{PHASE\}/g, phase)
}

const CUSTOM_TEMPLATES_KEY = 'jarvis-trainer-templates'

/** Read custom templates from localStorage. Returns empty array on parse error or SSR. */
export function getCustomTemplates(): TrainerTemplate[] {
  if (typeof window === 'undefined') return []
  try {
    const raw = localStorage.getItem(CUSTOM_TEMPLATES_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as TrainerTemplate[]
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

/** Create and save a new custom template to localStorage. Returns the saved template. */
export function saveCustomTemplate(
  template: Omit<TrainerTemplate, 'id' | 'isCustom'>
): TrainerTemplate {
  const newTemplate: TrainerTemplate = {
    ...template,
    id: `custom-${Date.now()}`,
    isCustom: true,
  }
  const existing = getCustomTemplates()
  const updated = [...existing, newTemplate]
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated))
  return newTemplate
}

/** Delete a custom template by id from localStorage. */
export function deleteCustomTemplate(id: string): void {
  const existing = getCustomTemplates()
  const updated = existing.filter(t => t.id !== id)
  localStorage.setItem(CUSTOM_TEMPLATES_KEY, JSON.stringify(updated))
}
