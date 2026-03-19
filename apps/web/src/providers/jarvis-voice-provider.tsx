'use client'

import { createContext, useContext, useCallback, useEffect, useRef } from 'react'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import { useJarvisTTS } from '@/hooks/use-jarvis-tts'
import { useWakeWord } from '@/hooks/use-wake-word'
import { useAudioRecorder } from '@/hooks/use-audio-recorder'
import { useJarvisBrain } from '@/hooks/use-jarvis-brain'
import { useVoiceCues } from '@/hooks/use-voice-cues'
import { getPhaseTransitionLine } from '@/lib/phase-personality'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'
import type { ConversationEntry } from '@jarvis-dcs/shared'
import type { RealtimeChannel } from '@supabase/supabase-js'

type VoiceState = 'idle' | 'listening' | 'wake-detected' | 'recording' | 'processing' | 'speaking' | 'error' | 'limit'

interface JarvisVoiceContextValue {
  voiceState: VoiceState
  isSpeaking: boolean
  wakeWordState: string
  recorderState: string
}

const JarvisVoiceContext = createContext<JarvisVoiceContextValue | null>(null)

export function JarvisVoiceProvider({ children }: { children: React.ReactNode }) {
  const { telemetry, connectionState, alerts, flightPhase, currentSession } = useTelemetryContext()

  // TTS with priority queue
  const { speak, stop: stopSpeaking, isSpeaking } = useJarvisTTS()

  // Brain: rule engine + GPT-4o fallback (phase-aware)
  const { processTranscript } = useJarvisBrain({ telemetry, speak, flightPhase: flightPhase.phase })

  // Track whether we're currently processing a command
  const isProcessingRef = useRef(false)

  // Conversation window: after JARVIS speaks, auto-listen for follow-ups
  const conversationWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inConversationRef = useRef(false)
  const speakingPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const CONVERSATION_WINDOW_MS = 10000

  const clearConversationWindow = useCallback(() => {
    if (conversationWindowRef.current) {
      clearTimeout(conversationWindowRef.current)
      conversationWindowRef.current = null
    }
    if (speakingPollRef.current) {
      clearInterval(speakingPollRef.current)
      speakingPollRef.current = null
    }
    if (inConversationRef.current) {
      inConversationRef.current = false
      console.log('[JARVIS] Conversation window closed')
    }
  }, [])

  // Persistent broadcast channel — created once per sessionId, reused by broadcastConversation
  const broadcastChannelRef = useRef<RealtimeChannel | null>(null)

  // Ref for speak so the broadcast listener can use it without re-subscribing
  const speakRef = useRef(speak)
  speakRef.current = speak
  const broadcastConversationRef = useRef<(role: 'player' | 'jarvis', text: string) => void>(() => {})

  useEffect(() => {
    const sessionId = currentSession?.id
    if (!sessionId) return
    const channelName = getChannelName(sessionId)
    // Use base channel name so conversation events reach useTrainerLog
    // on the trainer side. Multiple objects on same topic is fine.
    const ch = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    })

    // Listen for trainer messages — speak them as JARVIS on the player's side
    ch.on('broadcast', { event: 'trainer_speak' }, (msg) => {
      const text = msg.payload?.text
      if (text && typeof text === 'string') {
        console.log('[JARVIS] Trainer message received:', text)
        speakRef.current(text, 'P1')
        broadcastConversationRef.current('jarvis', text)
      }
    })

    ch.subscribe()
    broadcastChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      broadcastChannelRef.current = null
    }
  }, [currentSession?.id])

  // Broadcast a conversation entry to the session channel for the trainer
  const broadcastConversation = useCallback((role: 'player' | 'jarvis', text: string) => {
    const ch = broadcastChannelRef.current
    if (!ch) return
    const payload: ConversationEntry = { type: 'conversation', role, text, ts: Date.now() }
    ch.send({
      type: 'broadcast',
      event: 'conversation',
      payload,
    })
  }, [])

  // Keep ref in sync for the broadcast listener
  broadcastConversationRef.current = broadcastConversation

  // Callback for voice cues — broadcasts proactive Jarvis alerts to trainer
  const handleVoiceCueSpeak = useCallback((text: string) => {
    broadcastConversation('jarvis', text)
  }, [broadcastConversation])

  // Ref to hold startRecording — breaks circular dependency with openConversationWindow
  const startRecordingRef = useRef<() => void>(() => {})

  // Open a conversation window: wait for TTS to finish, then auto-record
  const openConversationWindow = useCallback(() => {
    // Clear any existing window
    if (speakingPollRef.current) clearInterval(speakingPollRef.current)
    if (conversationWindowRef.current) clearTimeout(conversationWindowRef.current)

    // Poll until TTS finishes, then wait for speaker audio to dissipate before recording
    speakingPollRef.current = setInterval(() => {
      if (!isSpeaking.current) {
        clearInterval(speakingPollRef.current!)
        speakingPollRef.current = null

        // Wait 1s after TTS stops so the mic doesn't pick up speaker echo
        setTimeout(() => {
          // Bail if conversation was closed during the delay
          if (conversationWindowRef.current === null && !inConversationRef.current) return

          inConversationRef.current = true
          console.log('[JARVIS] Conversation window opened (after 1s cooldown)')

          // Auto-start recording (no wake word needed)
          startRecordingRef.current()

          // Safety timeout: if the recorder's silence detection doesn't fire,
          // close the window after CONVERSATION_WINDOW_MS
          conversationWindowRef.current = setTimeout(() => {
            clearConversationWindow()
          }, CONVERSATION_WINDOW_MS)
        }, 1000)
      }
    }, 100)
  }, [isSpeaking, clearConversationWindow])

  // Audio recorder — sends audio to Whisper, then to brain
  const handleRecorded = useCallback(async (blob: Blob) => {
    const wasInConversation = inConversationRef.current
    // Clear conversation window while processing
    clearConversationWindow()

    isProcessingRef.current = true
    let gotReply = false
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
        // During conversation window, silence with no speech = close window
        if (wasInConversation) {
          console.log('[JARVIS] No speech during conversation window, closing')
          return
        }
        speak('I didn\'t catch that.', 'P3')
        return
      }

      // During conversation window, discard very short transcriptions (likely speaker echo)
      if (wasInConversation && text.trim().split(/\s+/).length <= 2) {
        console.log('[JARVIS] Discarding short echo in conversation window:', text)
        return
      }

      console.log('[JARVIS] Transcribed:', text)
      broadcastConversation('player', text)
      const reply = await processTranscript(text)
      if (reply) {
        broadcastConversation('jarvis', reply)
        gotReply = true
      }
    } catch (err) {
      console.error('[JARVIS] Recording pipeline error:', err)
      speak('Processing error.', 'P2')
    } finally {
      isProcessingRef.current = false
      // Open conversation window after a successful exchange
      if (gotReply) {
        openConversationWindow()
      }
    }
  }, [speak, processTranscript, broadcastConversation, openConversationWindow, clearConversationWindow])

  const { state: recorderState, startRecording, setState: setRecorderState } = useAudioRecorder({
    silenceTimeout: 2500,
    maxDuration: 15000,
    onRecorded: handleRecorded,
  })

  // Keep ref in sync with actual startRecording
  startRecordingRef.current = startRecording

  // Wake word detection — triggers recording
  const handleWakeDetected = useCallback(() => {
    // Don't start recording if already processing or already recording (conversation window)
    if (isProcessingRef.current) return
    if (recorderState === 'recording') return
    // Clear any active conversation window — user is explicitly re-engaging
    clearConversationWindow()
    // Brief audible cue: stop any current speech
    stopSpeaking()
    startRecording()
  }, [startRecording, stopSpeaking, recorderState, clearConversationWindow])

  const { state: wakeWordState } = useWakeWord({
    enabled: true,
    onDetected: handleWakeDetected,
  })

  // Cleanup conversation window timers on unmount
  useEffect(() => {
    return () => clearConversationWindow()
  }, [clearConversationWindow])

  // Voice cues for connection state changes and alerts (phase-aware)
  // onSpeak callback broadcasts each spoken cue to the trainer session channel
  useVoiceCues(connectionState, alerts, speak, true, flightPhase.phase, handleVoiceCueSpeak)

  // Flight phase transition voice cues
  useEffect(() => {
    if (flightPhase.justTransitioned) {
      const line = getPhaseTransitionLine(flightPhase.phase, flightPhase.previousPhase)
      if (line) {
        speak(line, 'P3')
      }
    }
  }, [flightPhase.justTransitioned, flightPhase.phase, flightPhase.previousPhase, speak])

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
