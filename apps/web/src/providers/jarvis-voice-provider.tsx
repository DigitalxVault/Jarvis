'use client'

import { createContext, useContext, useCallback, useEffect, useRef } from 'react'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import { useJarvisTTS } from '@/hooks/use-jarvis-tts'
import { useWakeWord } from '@/hooks/use-wake-word'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { useJarvisBrain } from '@/hooks/use-jarvis-brain'
import { useVoiceCues } from '@/hooks/use-voice-cues'

type VoiceState = 'idle' | 'listening' | 'wake-detected' | 'recording' | 'processing' | 'speaking' | 'error' | 'limit'

interface JarvisVoiceContextValue {
  voiceState: VoiceState
  isSpeaking: boolean
  wakeWordState: string
  recorderState: string
}

const JarvisVoiceContext = createContext<JarvisVoiceContextValue | null>(null)

export function JarvisVoiceProvider({ children }: { children: React.ReactNode }) {
  const { telemetry, connectionState, alerts } = useTelemetryContext()

  // TTS with priority queue
  const { speak, stop: stopSpeaking, isSpeaking } = useJarvisTTS()

  // Brain: rule engine + GPT-4o fallback
  const { processTranscript } = useJarvisBrain({ telemetry, speak })

  // Track whether we're currently processing a command
  const isProcessingRef = useRef(false)

  // Audio recorder — sends audio to Whisper, then to brain
  const handleRecorded = useCallback(async (blob: Blob) => {
    isProcessingRef.current = true
    try {
      const formData = new FormData()
      formData.append('audio', blob, 'audio.webm')

      const res = await fetch('/api/whisper', {
        method: 'POST',
        body: formData,
      })

      if (!res.ok) {
        speak('Transcription failed.', 'P2')
        return
      }

      const { text } = await res.json()
      if (!text?.trim()) {
        speak('I didn\'t catch that.', 'P3')
        return
      }

      console.log('[JARVIS] Transcribed:', text)
      await processTranscript(text)
    } catch (err) {
      console.error('[JARVIS] Recording pipeline error:', err)
      speak('Processing error.', 'P2')
    } finally {
      isProcessingRef.current = false
    }
  }, [speak, processTranscript])

  const { state: recorderState, startRecording, setState: setRecorderState } = useAudioRecorder({
    silenceTimeout: 1500,
    maxDuration: 10000,
    onRecorded: handleRecorded,
  })

  // Wake word detection — triggers recording
  const handleWakeDetected = useCallback(() => {
    // Don't start recording if already processing
    if (isProcessingRef.current) return
    // Brief audible cue: stop any current speech
    stopSpeaking()
    startRecording()
  }, [startRecording, stopSpeaking])

  const { state: wakeWordState } = useWakeWord({
    enabled: true,
    onDetected: handleWakeDetected,
  })

  // Voice cues for connection state changes and alerts
  useVoiceCues(connectionState, alerts, speak, true)

  // Reset recorder state when processing completes
  useEffect(() => {
    if (recorderState === 'processing' && !isProcessingRef.current) {
      setRecorderState('idle')
    }
  }, [recorderState, setRecorderState])

  // Derive composite voice state
  const voiceState: VoiceState =
    wakeWordState === 'limit' ? 'limit' :
    wakeWordState === 'error' ? 'error' :
    isSpeaking.current ? 'speaking' :
    recorderState === 'processing' ? 'processing' :
    recorderState === 'recording' ? 'recording' :
    wakeWordState === 'detected' ? 'wake-detected' :
    wakeWordState === 'listening' ? 'listening' :
    'idle'

  return (
    <JarvisVoiceContext.Provider value={{
      voiceState,
      isSpeaking: isSpeaking.current,
      wakeWordState,
      recorderState,
    }}>
      {children}
    </JarvisVoiceContext.Provider>
  )
}

export function useJarvisVoice(): JarvisVoiceContextValue {
  const ctx = useContext(JarvisVoiceContext)
  if (!ctx) throw new Error('useJarvisVoice must be used within JarvisVoiceProvider')
  return ctx
}
