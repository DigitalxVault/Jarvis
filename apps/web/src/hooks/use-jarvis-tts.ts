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
 * - P3 (info):     Queues at end, dropped if queue is too long
 *
 * Deduplicates: won't queue the same text that's already queued.
 * Max queue size of 3 to prevent buildup during flip-flop.
 */
export function useJarvisTTS() {
  const queueRef = useRef<QueuedSpeech[]>([])
  const isSpeakingRef = useRef(false)
  const abortRef = useRef<(() => void) | null>(null)
  const currentTextRef = useRef<string>('')

  const processQueue = useCallback(async () => {
    if (isSpeakingRef.current || queueRef.current.length === 0) return

    // Sort by priority (P1 first)
    queueRef.current.sort((a, b) => {
      const order = { P1: 0, P2: 1, P3: 2 }
      return order[a.priority] - order[b.priority]
    })

    const next = queueRef.current.shift()!
    isSpeakingRef.current = true
    currentTextRef.current = next.text

    try {
      const { promise, abort } = speakWithElevenLabs({ text: next.text })
      abortRef.current = abort
      await promise
    } catch (err) {
      console.error('TTS playback error:', err)
    } finally {
      isSpeakingRef.current = false
      abortRef.current = null
      currentTextRef.current = ''
      // Process next item
      processQueue()
    }
  }, [])

  const speak = useCallback((text: string, priority: SpeechPriority = 'P3') => {
    if (!text.trim()) return

    // Deduplicate: skip if this exact text is already queued or currently playing
    if (currentTextRef.current === text) return
    if (queueRef.current.some(s => s.text === text)) return

    if (priority === 'P1') {
      // P1: Interrupt current speech
      if (abortRef.current) {
        abortRef.current()
        isSpeakingRef.current = false
        abortRef.current = null
        currentTextRef.current = ''
      }
      // Clear lower-priority items
      queueRef.current = queueRef.current.filter(s => s.priority === 'P1')
      // Add at front
      queueRef.current.unshift({ text, priority })
    } else {
      // Cap queue at 3 to prevent buildup
      if (queueRef.current.length >= 3) {
        // Drop lowest priority item from end
        queueRef.current.pop()
      }
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
      currentTextRef.current = ''
    }
    queueRef.current = []
  }, [])

  return { speak, stop, isSpeaking: isSpeakingRef }
}
