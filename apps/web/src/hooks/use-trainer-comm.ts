'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { speakWithElevenLabs } from '@/lib/elevenlabs'
import { getChannelName } from '@jarvis-dcs/shared'
import type { TelemetryPacket, ConversationEntry } from '@jarvis-dcs/shared'

export type CommStage = 'idle' | 'recording' | 'transcribing' | 'rephrasing' | 'speaking' | 'error'

export interface UseTrainerCommOptions {
  sessionId: string
  telemetry: TelemetryPacket | null
  flightPhase: string       // from useFlightPhase
  rephraseIntensity: number // 0-1, from settings
}

export interface UseTrainerCommReturn {
  stage: CommStage
  elapsedMs: number
  errorMessage: string
  analyserRef: React.RefObject<AnalyserNode | null>
  toggleRecording: () => void
  sendText: (input: string) => Promise<void>
}

export function useTrainerComm({
  sessionId,
  telemetry,
  flightPhase,
  rephraseIntensity,
}: UseTrainerCommOptions): UseTrainerCommReturn {
  const [stage, setStage] = useState<CommStage>('idle')
  const [elapsedMs, setElapsedMs] = useState(0)
  const [errorMessage, setErrorMessage] = useState('')

  // Refs to avoid stale closures in callbacks
  const telemetryRef = useRef(telemetry)
  telemetryRef.current = telemetry
  const flightPhaseRef = useRef(flightPhase)
  flightPhaseRef.current = flightPhase
  const rephraseIntensityRef = useRef(rephraseIntensity)
  rephraseIntensityRef.current = rephraseIntensity
  const sessionIdRef = useRef(sessionId)
  sessionIdRef.current = sessionId

  // Audio recording refs
  const analyserRef = useRef<AnalyserNode | null>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const elapsedTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const errorResetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const stageRef = useRef<CommStage>('idle')

  // Keep stageRef in sync with stage state
  useEffect(() => {
    stageRef.current = stage
  }, [stage])

  const handleError = useCallback((message: string) => {
    console.error('[TrainerComm]', message)
    setStage('error')
    stageRef.current = 'error'
    setErrorMessage(message)
    if (errorResetTimerRef.current) clearTimeout(errorResetTimerRef.current)
    errorResetTimerRef.current = setTimeout(() => {
      setStage('idle')
      stageRef.current = 'idle'
      setErrorMessage('')
    }, 3000)
  }, [])

  const clearRecordingTimers = useCallback(() => {
    if (elapsedTimerRef.current) {
      clearInterval(elapsedTimerRef.current)
      elapsedTimerRef.current = null
    }
    if (maxTimerRef.current) {
      clearTimeout(maxTimerRef.current)
      maxTimerRef.current = null
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
    }
    clearRecordingTimers()
    setElapsedMs(0)
  }, [clearRecordingTimers])

  const sendText = useCallback(async (input: string): Promise<void> => {
    if (!input.trim()) return

    try {
      // Rephrase
      setStage('rephrasing')
      stageRef.current = 'rephrasing'

      const rephraseRes = await fetch('/api/trainer-rephrase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          input: input.trim(),
          telemetry: telemetryRef.current,
          flightPhase: flightPhaseRef.current,
          intensity: rephraseIntensityRef.current,
        }),
      })

      if (!rephraseRes.ok) {
        const errorData = await rephraseRes.text()
        console.error('[TrainerComm] Rephrase error:', rephraseRes.status, errorData)
        throw new Error('Rephrase failed')
      }

      const { rephrasedText } = await rephraseRes.json() as { rephrasedText: string }
      const textToSpeak = rephrasedText || input.trim()

      // Speaking stage
      setStage('speaking')
      stageRef.current = 'speaking'

      // Broadcast to player channel and speak concurrently
      const channelName = getChannelName(sessionIdRef.current)
      const channel = supabase.channel(channelName)
      const payload: ConversationEntry = {
        type: 'conversation',
        role: 'jarvis',
        text: textToSpeak,
        ts: Date.now(),
      }
      channel.send({
        type: 'broadcast',
        event: 'conversation',
        payload,
      })

      // Await TTS playback
      const { promise } = speakWithElevenLabs({ text: textToSpeak })
      await promise

      setStage('idle')
      stageRef.current = 'idle'
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Communication failed'
      handleError(msg)
    }
  }, [handleError])

  const processVoice = useCallback(async (blob: Blob): Promise<void> => {
    try {
      setStage('transcribing')
      stageRef.current = 'transcribing'

      const formData = new FormData()
      formData.append('audio', blob, 'recording.webm')

      const transcribeRes = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      })

      if (!transcribeRes.ok) {
        throw new Error('Transcription failed')
      }

      const { text } = await transcribeRes.json() as { text: string }
      if (!text?.trim()) {
        throw new Error('No speech detected')
      }

      await sendText(text)
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Voice processing failed'
      handleError(msg)
    }
  }, [sendText, handleError])

  const toggleRecording = useCallback(() => {
    const currentStage = stageRef.current

    if (currentStage === 'recording') {
      stopRecording()
      return
    }

    if (currentStage !== 'idle') return

    // Start recording
    ;(async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })

        const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm'
        const mediaRecorder = new MediaRecorder(stream, { mimeType })

        // Set up AudioContext + AnalyserNode for waveform
        const audioCtx = new AudioContext()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 512
        source.connect(analyser)

        analyserRef.current = analyser
        audioCtxRef.current = audioCtx
        mediaRecorderRef.current = mediaRecorder
        chunksRef.current = []

        mediaRecorder.ondataavailable = (e) => {
          if (e.data.size > 0) chunksRef.current.push(e.data)
        }

        mediaRecorder.onstop = () => {
          // Stop all tracks
          stream.getTracks().forEach(t => t.stop())

          // Close AudioContext
          audioCtxRef.current?.close().catch(() => {})
          audioCtxRef.current = null
          analyserRef.current = null

          // Clear timers
          clearRecordingTimers()
          setElapsedMs(0)

          // Assemble blob and process
          const blob = new Blob(chunksRef.current, { type: 'audio/webm' })
          chunksRef.current = []

          if (blob.size > 100) {
            processVoice(blob)
          } else {
            setStage('idle')
            stageRef.current = 'idle'
          }
        }

        mediaRecorder.start(100)
        setStage('recording')
        stageRef.current = 'recording'

        // Elapsed timer — 100ms increments
        setElapsedMs(0)
        elapsedTimerRef.current = setInterval(() => {
          setElapsedMs(prev => prev + 100)
        }, 100)

        // 30-second max safety
        maxTimerRef.current = setTimeout(() => {
          stopRecording()
        }, 30000)
      } catch (err) {
        const isPermissionDenied = err instanceof Error && err.name === 'NotAllowedError'
        const msg = isPermissionDenied
          ? 'Microphone access denied. Please allow microphone permissions.'
          : 'Could not access microphone'
        handleError(msg)
      }
    })()
  }, [stopRecording, clearRecordingTimers, processVoice, handleError])

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
        mediaRecorderRef.current.stop()
      }
      audioCtxRef.current?.close().catch(() => {})
      clearRecordingTimers()
      if (errorResetTimerRef.current) clearTimeout(errorResetTimerRef.current)
    }
  }, [clearRecordingTimers])

  return {
    stage,
    elapsedMs,
    errorMessage,
    analyserRef,
    toggleRecording,
    sendText,
  }
}
