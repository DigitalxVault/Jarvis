'use client'

import { useCallback, useRef } from 'react'
import { processWithRuleEngine } from '@/lib/rule-engine'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import type { SpeechPriority } from '@/hooks/use-jarvis-tts'

interface UseJarvisBrainOptions {
  telemetry: TelemetryPacket | null
  speak: (text: string, priority: SpeechPriority) => void
}

/**
 * Jarvis brain: processes voice transcripts through rule engine first,
 * falls back to GPT-4o for complex queries.
 */
export function useJarvisBrain({ telemetry, speak }: UseJarvisBrainOptions) {
  const processingRef = useRef(false)

  const processTranscript = useCallback(async (transcript: string) => {
    if (!transcript.trim() || processingRef.current) return
    processingRef.current = true

    console.log('[JARVIS] Processing:', transcript)

    try {
      // Try rule engine first (instant, no API cost)
      const ruleResponse = processWithRuleEngine(transcript, telemetry)
      if (ruleResponse) {
        console.log('[JARVIS] Rule engine match:', ruleResponse)
        speak(ruleResponse, 'P2')
        return
      }

      // Fall through to GPT-4o
      console.log('[JARVIS] No rule match, routing to GPT-4o...')
      speak('Processing.', 'P3')

      const response = await fetch('/api/jarvis-brain', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ transcript, telemetry }),
      })

      if (!response.ok) {
        speak('Unable to process that request.', 'P2')
        return
      }

      const { reply } = await response.json()
      speak(reply, 'P2')
    } catch (err) {
      console.error('[JARVIS] Brain error:', err)
      speak('Processing error. Try again.', 'P2')
    } finally {
      processingRef.current = false
    }
  }, [telemetry, speak])

  return { processTranscript }
}
