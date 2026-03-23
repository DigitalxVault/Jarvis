'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type WakeWordState = 'inactive' | 'loading' | 'listening' | 'detected' | 'error' | 'limit'

interface UseWakeWordOptions {
  enabled?: boolean
  onDetected?: () => void
}

// Web Speech API type shim (Chrome/Edge)
interface SpeechRecognitionInstance {
  continuous: boolean
  interimResults: boolean
  lang: string
  start(): void
  stop(): void
  abort(): void
  onresult: ((ev: any) => void) | null
  onend: (() => void) | null
  onerror: ((ev: any) => void) | null
  onstart: (() => void) | null
}

declare global {
  interface Window {
    webkitSpeechRecognition: new () => SpeechRecognitionInstance
    SpeechRecognition: new () => SpeechRecognitionInstance
  }
}

/**
 * Wake word detection using the Web Speech API.
 * Listens continuously for "Jarvis" in speech transcripts.
 * Free, no API key required. Works in Chrome and Edge.
 */
export function useWakeWord({ enabled = true, onDetected }: UseWakeWordOptions = {}) {
  const [state, setState] = useState<WakeWordState>('inactive')
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null)
  const onDetectedRef = useRef(onDetected)
  const hasUserGesture = useRef(false)
  const stoppingRef = useRef(false)
  const cooldownRef = useRef(false)
  onDetectedRef.current = onDetected

  const start = useCallback(() => {
    if (recognitionRef.current) return

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SpeechRecognition) {
      console.error('[JARVIS] Web Speech API not supported in this browser')
      setState('error')
      return
    }

    setState('loading')
    const recognition = new SpeechRecognition()
    recognition.continuous = true
    recognition.interimResults = true
    recognition.lang = 'en-US'

    recognition.onstart = () => {
      setState('listening')
      console.log('[JARVIS] Wake word engine started — say "Jarvis"')
    }

    recognition.onresult = (ev: any) => {
      if (cooldownRef.current) return

      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        const transcript: string = ev.results[i][0].transcript
        if (/\bjarvis\b/i.test(transcript)) {
          console.log('[JARVIS] Wake word detected in:', transcript.trim())
          setState('detected')
          cooldownRef.current = true
          onDetectedRef.current?.()

          // Brief cooldown — stop and restart to clear the transcript buffer
          // so the wake word itself doesn't get sent to Whisper
          stoppingRef.current = true
          recognition.stop()

          setTimeout(() => {
            cooldownRef.current = false
            stoppingRef.current = false
            setState('listening')
            try {
              recognition.start()
            } catch {
              // Already started — ignore
            }
          }, 1500)
          return
        }
      }
    }

    recognition.onerror = (ev: any) => {
      // 'no-speech' and 'aborted' are normal — just restart
      if (ev.error === 'no-speech' || ev.error === 'aborted') return

      if (ev.error === 'not-allowed') {
        console.error('[JARVIS] Microphone permission denied')
        setState('error')
        return
      }

      console.warn('[JARVIS] Speech recognition error:', ev.error)
    }

    // Auto-restart when recognition ends (browser stops it periodically)
    recognition.onend = () => {
      if (stoppingRef.current) return
      if (recognitionRef.current && !cooldownRef.current) {
        try {
          recognition.start()
        } catch {
          // Already started — ignore
        }
      }
    }

    recognitionRef.current = recognition

    try {
      recognition.start()
    } catch (err) {
      console.error('[JARVIS] Failed to start speech recognition:', err)
      setState('error')
    }
  }, [])

  const stop = useCallback(() => {
    stoppingRef.current = true
    if (recognitionRef.current) {
      recognitionRef.current.onend = null
      recognitionRef.current.abort()
      recognitionRef.current = null
      setState('inactive')
    }
    stoppingRef.current = false
  }, [])

  // Wait for user gesture before starting (browser autoplay policy)
  useEffect(() => {
    if (!enabled || hasUserGesture.current) return

    const handleGesture = () => {
      hasUserGesture.current = true
      start()
      document.removeEventListener('click', handleGesture)
      document.removeEventListener('keydown', handleGesture)
    }

    document.addEventListener('click', handleGesture, { once: true })
    document.addEventListener('keydown', handleGesture, { once: true })

    return () => {
      document.removeEventListener('click', handleGesture)
      document.removeEventListener('keydown', handleGesture)
    }
  }, [enabled, start])

  // If user already gestured and enabled changes, start/stop directly
  useEffect(() => {
    if (!hasUserGesture.current) return
    if (enabled) {
      start()
    } else {
      stop()
    }
    return () => { stop() }
  }, [enabled, start, stop])

  return { state, start, stop }
}
