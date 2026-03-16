'use client'

import { useEffect, useRef, useCallback, useState } from 'react'

type WakeWordState = 'inactive' | 'loading' | 'listening' | 'detected' | 'error'

interface UseWakeWordOptions {
  enabled?: boolean
  onDetected?: () => void
}

/**
 * Porcupine wake word detection hook.
 * Loads the built-in "Jarvis" keyword and listens continuously.
 */
export function useWakeWord({ enabled = true, onDetected }: UseWakeWordOptions = {}) {
  const [state, setState] = useState<WakeWordState>('inactive')
  const porcupineRef = useRef<any>(null)
  const onDetectedRef = useRef(onDetected)
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
    } catch (err) {
      console.error('[JARVIS] Wake word init error:', err)
      setState('error')
    }
  }, [])

  const stop = useCallback(async () => {
    if (porcupineRef.current) {
      await porcupineRef.current.release()
      porcupineRef.current = null
      setState('inactive')
    }
  }, [])

  useEffect(() => {
    if (enabled) {
      start()
    } else {
      stop()
    }
    return () => { stop() }
  }, [enabled, start, stop])

  return { state, start, stop }
}
