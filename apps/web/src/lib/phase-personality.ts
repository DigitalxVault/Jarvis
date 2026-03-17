import type { FlightPhase } from '@/lib/flight-phases'

/**
 * Phase-aware personality adapter for JARVIS voice cues.
 *
 * Each flight phase has a distinct communication style:
 * - PARKED/STARTUP: Warm, friendly, pre-flight briefing tone
 * - TAXI: Calm, checklist-oriented
 * - TAKEOFF: Focused, concise, encouraging
 * - CRUISE: Relaxed, conversational, occasional commentary
 * - COMBAT: Sharp, urgent, minimal words
 * - LANDING: Focused, precise, stabilized approach calls
 */

export interface PhasePersonality {
  /** Tone description for GPT-4o system prompt */
  toneDirective: string
  /** Max response words — shorter in high-workload phases */
  maxWords: number
  /** How JARVIS addresses the pilot */
  addressStyle: 'sir' | 'pilot'
  /** Whether to use aviation brevity codes */
  useBrevity: boolean
}

const personalities: Record<FlightPhase, PhasePersonality> = {
  PARKED: {
    toneDirective: 'Warm and friendly. You are in pre-flight mode. Be conversational and relaxed. Offer to help with mission planning or systems checks.',
    maxWords: 50,
    addressStyle: 'sir',
    useBrevity: false,
  },
  STARTUP: {
    toneDirective: 'Calm and systematic. The pilot is starting up the aircraft. Guide through startup if asked. Be encouraging.',
    maxWords: 40,
    addressStyle: 'sir',
    useBrevity: false,
  },
  TAXI: {
    toneDirective: 'Calm and checklist-oriented. The pilot is taxiing to the runway. Be brief and clear.',
    maxWords: 30,
    addressStyle: 'sir',
    useBrevity: false,
  },
  TAKEOFF: {
    toneDirective: 'Focused and concise. The pilot is taking off. Only essential callouts. Be encouraging but brief.',
    maxWords: 20,
    addressStyle: 'sir',
    useBrevity: true,
  },
  CRUISE: {
    toneDirective: 'Relaxed and conversational. The pilot is in stable flight. You can be more detailed in responses. Offer occasional tips or observations about the flight.',
    maxWords: 50,
    addressStyle: 'sir',
    useBrevity: false,
  },
  COMBAT: {
    toneDirective: 'Sharp and urgent. Minimum words. Use aviation brevity codes. The pilot is in a high-workload situation — every second counts.',
    maxWords: 15,
    addressStyle: 'pilot',
    useBrevity: true,
  },
  LANDING: {
    toneDirective: 'Focused and precise. The pilot is on approach. Call out key parameters. Be stabilized-approach focused.',
    maxWords: 20,
    addressStyle: 'sir',
    useBrevity: true,
  },
}

export function getPhasePersonality(phase: FlightPhase): PhasePersonality {
  return personalities[phase]
}

/**
 * Build a phase-aware system prompt addition for GPT-4o.
 */
export function getPhaseSystemPromptAddition(phase: FlightPhase): string {
  const p = personalities[phase]
  return `\n\nCurrent flight phase: ${phase}
Tone: ${p.toneDirective}
Max response length: ${p.maxWords} words.
${p.useBrevity ? 'Use aviation brevity codes where appropriate (e.g., "Angels 25" for 25,000ft, "Buster" for max speed).' : ''}
Address the pilot as "${p.addressStyle}".`
}

/**
 * Phase transition voice lines — what JARVIS says when entering a new phase.
 */
const phaseTransitionLines: Record<FlightPhase, string | null> = {
  PARKED: null, // Don't announce parking
  STARTUP: 'Systems coming online sir. Running pre-flight checks.',
  TAXI: 'Taxiing. All systems green sir.',
  TAKEOFF: 'Cleared for takeoff sir. Good luck up there.',
  CRUISE: 'Stable flight sir. Cruise altitude established. I\'m monitoring all systems.',
  COMBAT: 'Combat detected. Switching to tactical mode. Stay sharp.',
  LANDING: 'On approach sir. I\'ll call out your altitude and speed.',
}

/**
 * Get the voice line for a phase transition, or null if no announcement needed.
 */
export function getPhaseTransitionLine(
  newPhase: FlightPhase,
  previousPhase: FlightPhase | null
): string | null {
  // Don't announce if going to PARKED
  if (newPhase === 'PARKED') return null

  // Don't announce STARTUP → TAXI (too mundane)
  if (newPhase === 'TAXI' && previousPhase === 'STARTUP') return null

  // Don't announce if coming from null (initial state)
  if (!previousPhase) return null

  return phaseTransitionLines[newPhase]
}

/**
 * Phase-aware alert voice line modifiers.
 * In COMBAT, alerts are terse. In CRUISE, they're more conversational.
 */
export function getPhaseAlertPrefix(phase: FlightPhase): string {
  switch (phase) {
    case 'COMBAT':
      return '' // No prefix in combat — every word counts
    case 'LANDING':
      return '' // No prefix on approach
    case 'TAKEOFF':
      return '' // No prefix during takeoff
    default:
      return 'Sir, '
  }
}
