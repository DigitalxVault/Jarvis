'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

export type WakeWordState = 'inactive' | 'loading' | 'listening' | 'detected' | 'error' | 'limit'

interface UseWakeWordOptions {
  enabled?: boolean
  onDetected?: () => void
}

/**
 * Porcupine wake word detection hook.
 * Loads the built-in "Jarvis" keyword and listens continuously.
 * Requires a user gesture (click) before starting due to AudioContext restrictions.
 */
export function useWakeWord({ enabled = true, onDetected }: UseWakeWordOptions = {}) {
  const [state, setState] = useState<WakeWordState>('inactive')
  const porcupineRef = useRef<any>(null)
  const onDetectedRef = useRef(onDetected)
  const hasUserGesture = useRef(false)
  onDetectedRef.current = onDetected

  const start = useCallback(async () => {
    if (porcupineRef.current) return

    setState('loading')
    try {
      // Fetch access key from server (not exposed as NEXT_PUBLIC)
      const configRes = await fetch('/api/voice-config')
      if (!configRes.ok) {
        console.error('Failed to fetch voice config')
        setState('error')
        return
      }
      const { picovoiceAccessKey: accessKey } = await configRes.json()
      if (!accessKey) {
        console.error('Picovoice access key not set')
        setState('error')
        return
      }

      // Dynamic import to avoid SSR issues
      const { PorcupineWorker } = await import('@picovoice/porcupine-web')

      const porcupine = await PorcupineWorker.create(
        accessKey,
        [{ builtin: 'Jarvis' as any, sensitivity: 0.6 }],
        (detection: { label: string; index: number }) => {
          console.log('[JARVIS] Wake word detected:', detection.label)
          setState('detected')
          onDetectedRef.current?.()
          // Reset to listening after a moment
          setTimeout(() => setState('listening'), 500)
        },
        { publicPath: '/porcupine_params.pv', forceWrite: true },
      )

      porcupineRef.current = porcupine
      setState('listening')
      console.log('[JARVIS] Wake word engine started — say "Jarvis"')
    } catch (err: any) {
      const msg = err?.message || String(err)
      // Handle Picovoice activation limit (free tier = limited active devices)
      if (msg.includes('ActivationLimit') || msg.includes('Activation')) {
        console.warn('[JARVIS] Picovoice activation limit reached — voice active on another device')
        setState('limit')
      } else {
        console.error('[JARVIS] Wake word init error:', err)
        setState('error')
      }
    }
  }, [])

  const stop = useCallback(async () => {
    if (porcupineRef.current) {
      await porcupineRef.current.release()
      porcupineRef.current = null
      setState('inactive')
    }
  }, [])

  // Wait for user gesture before starting (browser AudioContext policy)
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
