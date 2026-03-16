'use client'

import { useCallback, useRef } from 'react'
import { speakWithElevenLabs } from '@/lib/elevenlabs'

export type SpeechPriority = 'P1' | 'P2' | 'P3'

interface QueuedSpeech {
  text: string
  priority: SpeechPriority
}

/**
 * Hook that manages Jarvis TTS with a priority queue.
 *
 * - P1 (critical): Interrupts current speech immediately
 * - P2 (warning):  Queues behind active speech, plays next
 * - P3 (info):     Waits for silence before speaking
 */
export function useJarvisTTS() {
  const queueRef = useRef<QueuedSpeech[]>([])
  const isSpeakingRef = useRef(false)
  const abortRef = useRef<(() => void) | null>(null)

  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current || queueRef.current.length === 0) return

    // Sort by priority (P1 first)
    queueRef.current.sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2 }
      return order[a.priority] - order[b.priority]
    })

    const next = queueRef.current.shift()!
    isSpeakingRef.current = true

    try {
      const { promise, abort } = speakWithElevenLabs({ text: next.text })
      abortRef.current = abort
      await promise
    } catch (err) {
      console.error('TTS playback error:', err)
    } finally {
      isSpeakingRef.current = false
      abortRef.current = null
      // Process next item
      processQueue()
    }
  }, [])

  const speak = useCallback((text: string, priority: SpeechPriority = 'P3') => {
    if (!text.trim()) return

    if (priority === 'P1') {
      // P1: Interrupt current speech
      if (abortRef.current) {
        abortRef.current()
        isSpeakingRef.current = false
        abortRef.current = null
      }
      // Clear any P3 items from queue (they can wait)
      queueRef.current = queueRef.current.filter(s => s.priority !== 'P3')
      // Add at front
      queueRef.current.unshift({ text, priority })
    } else {
      queueRef.current.push({ text, priority })
    }

    // Kick off processing
    if (!isSpeakingRef.current) {
      processQueue()
    }
  }, [processQueue])

  const stop = useCallback(() => {
    if (abortRef.current) {
      abortRef.current()
      isSpeakingRef.current = false
      abortRef.current = null
    }
    queueRef.current = []
  }, [])

  return { speak, stop, isSpeaking: isSpeakingRef }
}
