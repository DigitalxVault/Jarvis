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
 * Porcupine v4 requires manual audio feeding via process(pcm).
 */
export function useWakeWord({ enabled = true, onDetected }: UseWakeWordOptions = {}) {
  const [state, setState] = useState<WakeWordState>('inactive')
  const porcupineRef = useRef<any>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
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
        [{ builtin: 'Jarvis' as any, sensitivity: 0.9 }],
        (detection: { label: string; index: number }) => {
          console.log('[JARVIS] Wake word detected:', detection.label)
          setState('detected')
          onDetectedRef.current?.()
          setTimeout(() => setState('listening'), 500)
        },
        { publicPath: '/porcupine_params.pv', forceWrite: true },
      )

      porcupineRef.current = porcupine

      // Porcupine v4 does NOT capture mic audio — we must feed it manually.
      // Get mic stream and pipe audio frames via ScriptProcessorNode.
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true },
      })
      streamRef.current = stream

      const audioCtx = new AudioContext({ sampleRate: porcupine.sampleRate })
      audioCtxRef.current = audioCtx

      const source = audioCtx.createMediaStreamSource(stream)
      // ScriptProcessorNode bufferSize should match Porcupine's frameLength
      const processor = audioCtx.createScriptProcessor(
        porcupine.frameLength, 1, 1,
      )
      processorRef.current = processor

      processor.onaudioprocess = (ev: AudioProcessingEvent) => {
        if (!porcupineRef.current) return
        const inputData = ev.inputBuffer.getChannelData(0)
        // Convert Float32 [-1,1] to Int16 PCM
        const pcm = new Int16Array(inputData.length)
        for (let i = 0; i < inputData.length; i++) {
          const s = Math.max(-1, Math.min(1, inputData[i]))
          pcm[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
        }
        porcupine.process(pcm)
      }

      source.connect(processor)
      processor.connect(audioCtx.destination) // Required for onaudioprocess to fire

      setState('listening')
      console.log('[JARVIS] Wake word engine started — say "Jarvis"')
    } catch (err: any) {
      const msg = err?.message || String(err)
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
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (audioCtxRef.current) {
      await audioCtxRef.current.close().catch(() => {})
      audioCtxRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
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
