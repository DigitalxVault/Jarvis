'use client'

import { useCallback, useRef } from 'react'
import { processWithRuleEngine } from '@/lib/rule-engine'
import type { TelemetryPacket, TacticalPacket } from '@jarvis-dcs/shared'
import type { SpeechPriority } from '@/hooks/use-jarvis-tts'
import type { FlightPhase } from '@/lib/flight-phases'

interface UseJarvisBrainOptions {
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
  speak: (text: string, priority: SpeechPriority) => void
  flightPhase?: FlightPhase
}

/**
 * Jarvis brain: processes voice transcripts through rule engine first,
 * falls back to GPT-4o for complex queries.
 */
export function useJarvisBrain({ telemetry, tactical, speak, flightPhase }: UseJarvisBrainOptions) {
  const processingRef = useRef(false)

  const processTranscript = useCallback(async (transcript: string): Promise<string | undefined> => {
    if (!transcript.trim() || processingRef.current) return undefined
    processingRef.current = true

    console.log('[JARVIS] Processing:', transcript)

    try {
      // Try rule engine first (instant, no API cost)
      const ruleResponse = processWithRuleEngine(transcript, telemetry, flightPhase, tactical)
      if (ruleResponse) {
        console.log('[JARVIS] Rule engine match:', ruleResponse)
        speak(ruleResponse, 'P2')
        return ruleResponse
      }

      // Fall through to GPT-4o
      console.log('[JARVIS] No rule match, routing to GPT-4o...')
      speak('Processing.', 'P3')

      const response = await fetch('/api/jarvis-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, telemetry, tactical, flightPhase }),
      })

      if (!response.ok) {
        speak('Unable to process that request.', 'P2')
        return undefined
      }

      const { reply } = await response.json()
      speak(reply, 'P2')
      return reply
    } catch (err) {
      console.error('[JARVIS] Brain error:', err)
      speak('Processing error. Try again.', 'P2')
      return undefined
    } finally {
      processingRef.current = false
    }
  }, [telemetry, tactical, speak, flightPhase])

  return { processTranscript }
}
