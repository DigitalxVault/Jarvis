import { NextRequest, NextResponse } from 'next/server'
import { getPhaseSystemPromptAddition } from '@/lib/phase-personality'
import type { FlightPhase } from '@/lib/flight-phases'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

export const runtime = 'nodejs'

/** Valid flight phases for validation */
const VALID_PHASES: FlightPhase[] = ['PARKED', 'STARTUP', 'TAXI', 'TAKEOFF', 'CRUISE', 'COMBAT', 'LANDING']

/** Build a telemetry context string for the GPT-4o system prompt */
function buildTelemetryContext(telemetry: TelemetryPacket | null | undefined): string {
  if (!telemetry) return ''
  const t = telemetry
  return `\n\nCurrent aircraft state:
- Altitude: ${t.pos?.alt_m ? Math.round(t.pos.alt_m * 3.28084) + ' ft MSL' : 'unknown'}
- AGL: ${t.pos?.alt_agl_m ? Math.round(t.pos.alt_agl_m * 3.28084) + ' ft' : 'unknown'}
- Airspeed: ${t.spd?.ias_mps ? Math.round(t.spd.ias_mps * 1.94384) + ' kts IAS' : 'unknown'}
- Mach: ${t.spd?.mach?.toFixed(2) ?? 'unknown'}
- Heading: ${t.hdg_rad != null ? Math.round((t.hdg_rad * 180 / Math.PI + 360) % 360) + '°' : 'unknown'}
- Vertical speed: ${t.spd?.vvi_mps ? Math.round(t.spd.vvi_mps * 196.85) + ' fpm' : 'unknown'}
- G-load: ${t.aero?.g?.y?.toFixed(1) ?? 'unknown'} G
- AoA: ${t.aero?.aoa_rad ? (t.aero.aoa_rad * 180 / Math.PI).toFixed(1) + '°' : 'unknown'}
- Fuel: ${t.fuel?.internal != null ? Math.round(t.fuel.internal * 100) + '% internal' : 'unknown'}
- Engine RPM: ${t.eng?.rpm_pct?.toFixed(0) ?? 'unknown'}%`
}

/** Get system prompt based on rephrase intensity tier */
function buildSystemPrompt(intensity: number, flightPhase: FlightPhase): string {
  let basePrompt: string

  if (intensity < 0.25) {
    // Minimal — clean up grammar only
    basePrompt = `You are helping an instructor communicate with a student pilot through an AI co-pilot interface.
Clean up the instructor's message: fix grammar, add relevant aviation terminology where natural, but preserve the instructor's exact intent and sentence structure. Keep the same number of sentences. Do not add personality or embellishments.`
  } else if (intensity < 0.75) {
    // Medium — rewrite as JARVIS voice
    basePrompt = `You are JARVIS, an AI co-pilot assistant for a fighter pilot flying an F-16C Viper in DCS World.
An instructor has sent you a message to relay to the pilot. Rewrite it in your voice — calm, professional, concise. Keep the core meaning intact. 1-3 sentences maximum. Use aviation terminology naturally.`
  } else {
    // Full — complete JARVIS personality rewrite
    basePrompt = `You are JARVIS, an AI co-pilot assistant for a fighter pilot flying an F-16C Viper in DCS World.
Your personality: calm, professional, concise — like a trusted AI wingman. Use aviation brevity codes naturally. Address the pilot as "sir".
An instructor has sent a message. Rewrite it completely in your voice. Under 30 words. Add references to current telemetry data if appropriate and natural.`
  }

  const phaseAddition = getPhaseSystemPromptAddition(flightPhase)
  return basePrompt + phaseAddition
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    const body = await req.json()
    const { input, telemetry, flightPhase, intensity } = body

    if (!input || typeof input !== 'string' || !input.trim()) {
      return NextResponse.json({ error: 'No input provided' }, { status: 400 })
    }

    // Clamp intensity to 0-1, default 0.5
    const rawIntensity = typeof intensity === 'number' ? intensity : 0.5
    const clampedIntensity = Math.max(0, Math.min(1, rawIntensity))

    // Intensity === 0 bypass: skip GPT-4o entirely
    if (clampedIntensity === 0) {
      return NextResponse.json({ rephrasedText: input })
    }

    // Validate / default flight phase
    const validPhase: FlightPhase = VALID_PHASES.includes(flightPhase) ? flightPhase : 'CRUISE'

    const systemPrompt = buildSystemPrompt(clampedIntensity, validPhase)
    const telemetryContext = buildTelemetryContext(telemetry)

    // Temperature scales with intensity: 0.3 at minimum → 0.8 at maximum
    const temperature = 0.3 + clampedIntensity * 0.5

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: input + telemetryContext },
        ],
        max_tokens: 100,
        temperature,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('[Trainer] GPT-4o rephrase error:', response.status, error)
      // Fallback to original input on API error
      return NextResponse.json({ rephrasedText: input })
    }

    const result = await response.json()
    const rephrasedText = result.choices?.[0]?.message?.content?.trim() || input

    return NextResponse.json({ rephrasedText })
  } catch (err) {
    console.error('[Trainer] Rephrase route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
