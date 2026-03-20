import { NextRequest, NextResponse } from 'next/server'
import type { TacticalPacket } from '@jarvis-dcs/shared'

export const runtime = 'nodejs'

const DEFAULT_SYSTEM_PROMPT = `You are JARVIS, an AI co-pilot assistant for a fighter pilot flying an F-16C Viper in DCS World (combat flight simulator).

Your personality:
- Calm, professional, and concise — like a friendly military instructor
- Use aviation terminology naturally (angels for altitude in thousands, bogey/bandit for enemies, RTB for return to base)
- Keep responses SHORT — 1-2 sentences max. The pilot is flying and can't read long text.
- Be direct and helpful. No filler words.
- Address the pilot as "sir" — you are their trusted AI wingman.

You have access to the current aircraft telemetry AND tactical situational awareness data.
Answer questions about the aircraft state using the provided telemetry.
When asked about enemies, bogeys, bandits, threats, or contacts — use the tactical SA data to give bearing, range, and altitude relative to the pilot. Use clock positions or compass bearings.
For tactical advice, be practical and specific — recommend engagement or evasion based on the situation.

Beyond flight operations, you are a highly capable AI assistant with broad general knowledge.
When the pilot asks non-flight questions (science, history, math, time, weather, pop culture, or anything else):
- Answer confidently and professionally, as a sophisticated AI would
- Stay in character — you're still JARVIS, still calm and composed
- Be concise but thorough enough to actually answer the question
- For time/date questions: you have no internal clock, so say "I don't have access to a clock, sir. Check your watch or the HUD clock."
- For real-world weather: clarify you only have access to aircraft data, not external weather services
- Never say "I'm just a flight assistant" or deflect — you're a full AI, answer the question
Flight context always takes priority, but you can handle anything the pilot throws at you.

IMPORTANT: Keep responses under 30 words when possible. The pilot needs quick answers.`

/** Phase-specific prompt additions */
const PHASE_PROMPTS: Record<string, string> = {
  PARKED: '\n\nThe aircraft is parked. Be warm and conversational. Help with pre-flight planning if asked.',
  STARTUP: '\n\nThe pilot is starting the aircraft. Be systematic and encouraging. Guide through startup if asked.',
  TAXI: '\n\nThe pilot is taxiing. Be brief and clear. Focus on departure preparations.',
  TAKEOFF: '\n\nThe pilot is taking off. Be very concise — only essential callouts. Max 15 words.',
  CRUISE: '\n\nThe pilot is in stable cruise flight. You can be slightly more detailed and conversational. Offer tips if appropriate.',
  COMBAT: '\n\nCOMBAT MODE. Maximum brevity. Use aviation brevity codes. Every word counts. Max 10 words. Address pilot as "pilot" not "sir".',
  LANDING: '\n\nThe pilot is on final approach. Be precise and focused. Call out altitude and speed deviations. Max 15 words.',
}

export async function POST(req: NextRequest) {
  const apiKey = process.env.OPENAI_API_KEY
  if (!apiKey) {
    return NextResponse.json({ error: 'OpenAI API key not configured' }, { status: 500 })
  }

  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const body = await req.json() as any
    const { transcript, telemetry, flightPhase } = body
    const tactical = (body.tactical ?? null) as TacticalPacket | null

    if (!transcript) {
      return NextResponse.json({ error: 'No transcript provided' }, { status: 400 })
    }

    // Build phase-aware system prompt
    const basePrompt = process.env.JARVIS_SYSTEM_PROMPT || DEFAULT_SYSTEM_PROMPT
    const phaseAddition = flightPhase ? (PHASE_PROMPTS[flightPhase] || '') : ''

    // Build context from telemetry
    let telemetryContext = ''
    if (telemetry) {
      const t = telemetry
      telemetryContext = `\n\nCurrent aircraft state:
- Altitude: ${t.pos?.alt_m ? Math.round(t.pos.alt_m * 3.28084) + ' ft MSL' : 'unknown'}
- AGL: ${t.pos?.alt_agl_m ? Math.round(t.pos.alt_agl_m * 3.28084) + ' ft' : 'unknown'}
- Airspeed: ${t.spd?.ias_mps ? Math.round(t.spd.ias_mps * 1.94384) + ' kts IAS' : 'unknown'}
- Mach: ${t.spd?.mach?.toFixed(2) ?? 'unknown'}
- Heading: ${t.hdg_rad != null ? Math.round((t.hdg_rad * 180 / Math.PI + 360) % 360) + '°' : 'unknown'}
- Vertical speed: ${t.spd?.vvi_mps ? Math.round(t.spd.vvi_mps * 196.85) + ' fpm' : 'unknown'}
- G-load: ${t.aero?.g?.y?.toFixed(1) ?? 'unknown'} G
- AoA: ${t.aero?.aoa_rad ? (t.aero.aoa_rad * 180 / Math.PI).toFixed(1) + '°' : 'unknown'}
- Fuel: ${t.fuel?.internal != null ? Math.round(t.fuel.internal * 100) + '% internal' : 'unknown'}
- Engine RPM: ${t.eng?.rpm_pct?.toFixed(0) ?? 'unknown'}%
- Position: ${t.pos?.lat?.toFixed(4) ?? '?'}°N, ${t.pos?.lon?.toFixed(4) ?? '?'}°E`
    }

    // Build tactical SA context
    let tacticalContext = ''
    if (tactical) {
      const parts: string[] = []

      // World objects (radar contacts)
      if (tactical.objects?.length) {
        const playerLat = telemetry?.pos?.lat
        const playerLon = telemetry?.pos?.lon
        const playerHdg = telemetry?.hdg_rad

        parts.push(`Radar contacts: ${tactical.objects.length} objects detected`)
        for (const obj of tactical.objects) {
          let bearingRange = ''
          if (playerLat != null && playerLon != null) {
            const dLat = obj.lat - playerLat
            const dLon = obj.lon - playerLon
            const bearing = Math.round(((Math.atan2(dLon, dLat) * 180 / Math.PI) + 360) % 360)
            const distNm = Math.round(Math.sqrt(dLat * dLat + dLon * dLon) * 60)
            // Relative bearing (clock position) if we have heading
            let relBearing = ''
            if (playerHdg != null) {
              const rel = ((bearing - (playerHdg * 180 / Math.PI) % 360) + 360) % 360
              const clock = Math.round(rel / 30) || 12
              relBearing = ` (${clock} o'clock)`
            }
            bearingRange = `bearing ${bearing.toString().padStart(3, '0')}°${relBearing}, ~${distNm}nm`
          }
          const altFt = Math.round(obj.alt * 3.28084)
          const coal = obj.coal === 'Enemies' ? 'HOSTILE' : obj.coal === 'Allies' ? 'FRIENDLY' : obj.coal
          parts.push(`  - ${coal}: ${obj.name}, ${bearingRange}, alt ${altFt.toLocaleString()}ft`)
        }
      }

      // Locked targets
      if (tactical.locked?.length) {
        for (const tgt of tactical.locked) {
          const distNm = Math.round(tgt.dist * 0.000539957)
          parts.push(`LOCKED TARGET: range ${distNm}nm, Mach ${tgt.mach.toFixed(1)}`)
        }
      }

      // Weapons loadout
      if (tactical.weapons) {
        const stationList = tactical.weapons.stations
          .filter(s => s.count > 0)
          .map(s => `${s.count}x ${s.name}`)
          .join(', ')
        const gunRounds = tactical.weapons.gun_rounds ?? 0
        parts.push(`Weapons: ${stationList || 'none'}${gunRounds > 0 ? `, gun ${gunRounds} rounds` : ''}`)
      }

      // Countermeasures
      if (tactical.countermeasures) {
        parts.push(`Countermeasures: chaff ${tactical.countermeasures.chaff}, flare ${tactical.countermeasures.flare}`)
      }

      if (parts.length > 0) {
        tacticalContext = '\n\nSituational awareness:\n' + parts.map(p => `- ${p}`).join('\n')
      }
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gpt-4o',
        messages: [
          { role: 'system', content: basePrompt + phaseAddition },
          { role: 'user', content: transcript + telemetryContext + tacticalContext },
        ],
        max_tokens: 200,
        temperature: 0.7,
      }),
    })

    if (!response.ok) {
      const error = await response.text()
      console.error('GPT-4o API error:', response.status, error)
      return NextResponse.json({ error: 'Brain processing failed' }, { status: 502 })
    }

    const result = await response.json()
    const reply = result.choices?.[0]?.message?.content ?? 'Unable to process that request.'

    return NextResponse.json({ reply })
  } catch (err) {
    console.error('Brain route error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
