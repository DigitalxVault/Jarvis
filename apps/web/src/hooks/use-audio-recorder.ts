'use client'

import { useRef, useCallback, useState } from 'react'

type RecorderState = 'idle' | 'recording' | 'processing'

interface UseAudioRecorderOptions {
  silenceTimeout?: number   // ms of silence before auto-stop (default: 1500)
  maxDuration?: number      // max recording duration in ms (default: 10000)
  onRecorded?: (blob: Blob) => void
}

/**
 * Records audio from the microphone after wake word detection.
 * Auto-stops on silence or timeout.
 */
export function useAudioRecorder({
  silenceTimeout = 1500,
  maxDuration = 10000,
  onRecorded,
}: UseAudioRecorderOptions = {}) {
  const [state, setState] = useState<RecorderState>('idle')
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const silenceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const animFrameRef = useRef<number>(0)
  const onRecordedRef = useRef(onRecorded)
  onRecordedRef.current = onRecorded

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    if (silenceTimerRef.current) clearTimeout(silenceTimerRef.current)
    if (maxTimerRef.current) clearTimeout(maxTimerRef.current)
    if (animFrameRef.current) cancelAnimationFrame(animFrameRef.current)
    setState('idle')
  }, [])

  const startRecording = useCallback(async () => {
    if (state === 'recording') return

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      })

      chunksRef.current = []
      mediaRecorderRef.current = mediaRecorder

      // Silence detection via AudioContext analyser
      const audioCtx = new AudioContext()
      const source = audioCtx.createMediaStreamSource(stream)
      const analyser = audioCtx.createAnalyser()
      analyser.fftSize = 512
      source.connect(analyser)
      analyserRef.current = analyser

      const dataArray = new Uint8Array(analyser.frequencyBinCount)
      let lastSoundTime = Date.now()

      const checkSilence = () => {
        analyser.getByteFrequencyData(dataArray)
        const avgLevel = dataArray.reduce((sum, v) => sum + v, 0) / dataArray.length

        if (avgLevel > 15) {
          lastSoundTime = Date.now()
        } else if (Date.now() - lastSoundTime > silenceTimeout) {
          // Silence detected
          stopRecording()
          audioCtx.close()
          return
        }

        if (mediaRecorderRef.current?.state === 'recording') {
          animFrameRef.current = requestAnimationFrame(checkSilence)
        }
      }

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }

      mediaRecorder.onstop = () => {
        stream.getTracks().forEach(t => t.stop())
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
        if (blob.size > 0) {
          setState('processing')
          onRecordedRef.current?.(blob)
        } else {
          setState('idle')
        }
        audioCtx.close().catch(() => {})
      }

      mediaRecorder.start(100) // collect data every 100ms
      setState('recording')

      // Start silence detection
      animFrameRef.current = requestAnimationFrame(checkSilence)

      // Max duration safety
      maxTimerRef.current = setTimeout(stopRecording, maxDuration)
    } catch (err) {
      console.error('[JARVIS] Mic access error:', err)
      setState('idle')
    }
  }, [state, silenceTimeout, maxDuration, stopRecording])

  return { state, startRecording, stopRecording, setState }
}
