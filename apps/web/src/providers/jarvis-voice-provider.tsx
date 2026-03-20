'use client'

import { createContext, useContext, useCallback, useEffect, useRef } from 'react'
import { usePathname } from 'next/navigation'
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
  const pathname = usePathname()
  const isTrainerRoute = pathname?.startsWith('/trainer')

  // On trainer route, skip all voice logic — trainer has its own comm system
  if (isTrainerRoute) {
    return (
      <JarvisVoiceContext.Provider value={{
        voiceState: 'idle',
        isSpeaking: false,
        wakeWordState: 'idle',
        recorderState: 'idle',
      }}>
        {children}
      </JarvisVoiceContext.Provider>
    )
  }

  return <JarvisVoiceProviderInner>{children}</JarvisVoiceProviderInner>
}

function JarvisVoiceProviderInner({ children }: { children: React.ReactNode }) {
  const { telemetry, connectionState, alerts, flightPhase, currentSession } = useTelemetryContext()

  // TTS with priority queue
  const { speak, stop: stopSpeaking, isSpeaking } = useJarvisTTS()

  // Brain: rule engine + GPT-4o fallback (phase-aware)
  const { processTranscript } = useJarvisBrain({ telemetry, speak, flightPhase: flightPhase.phase })

  // Track whether we're currently processing a command
  const isProcessingRef = useRef(false)

  // Track what JARVIS just said — used for echo detection
  const lastJarvisSpeechRef = useRef<string>('')

  // Conversation window: after JARVIS speaks, auto-listen for follow-ups
  const conversationWindowRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const inConversationRef = useRef(false)
  const pendingCooldownRef = useRef(false)  // true while waiting for post-TTS cooldown
  const speakingPollRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const CONVERSATION_WINDOW_MS = 25000

  const clearConversationWindow = useCallback(() => {
    if (conversationWindowRef.current) {
      clearTimeout(conversationWindowRef.current)
      conversationWindowRef.current = null
    }
    if (speakingPollRef.current) {
      clearInterval(speakingPollRef.current)
      speakingPollRef.current = null
    }
    pendingCooldownRef.current = false
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
    // Always broadcast on session:dev — telemetry channel is decoupled from DB sessions
    const channelName = getChannelName('dev')
    // Use base channel name so conversation events reach useTrainerLog
    // on the trainer side. Multiple objects on same topic is fine.
    const ch = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    })

    // Listen for trainer messages — speak them as JARVIS on the player's side,
    // then open conversation window so the pilot can respond without wake word
    ch.on('broadcast', { event: 'trainer_speak' }, (msg) => {
      const text = msg.payload?.text
      if (text && typeof text === 'string') {
        console.log('[JARVIS] Trainer message received:', text)
        lastJarvisSpeechRef.current = text
        speakRef.current(text, 'P1')
        broadcastConversationRef.current('jarvis', text)
        // Open conversation window so pilot can reply naturally
        openConversationWindowRef.current()
      }
    })

    ch.subscribe()
    broadcastChannelRef.current = ch
    return () => {
      supabase.removeChannel(ch)
      broadcastChannelRef.current = null
    }
  }, [])

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

  // Refs to hold startRecording and openConversationWindow — breaks circular dependencies
  const startRecordingRef = useRef<(overrides?: { silenceTimeout?: number; maxDuration?: number; noiseFloor?: number }) => void>(() => {})
  const openConversationWindowRef = useRef<() => void>(() => {})

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

        // Mark that we're in the cooldown phase
        pendingCooldownRef.current = true

        // Wait 1.5s after TTS stops so the mic doesn't pick up speaker echo
        setTimeout(() => {
          // Bail if conversation was cancelled during the cooldown
          if (!pendingCooldownRef.current) return
          pendingCooldownRef.current = false

          inConversationRef.current = true
          console.log('[JARVIS] Conversation window opened (after 1.5s cooldown)')

          // Auto-start recording with longer silence timeout (6s) and higher noise floor (30)
          // so the pilot has time to think and ambient noise doesn't trigger false positives
          startRecordingRef.current({ silenceTimeout: 6000, maxDuration: 20000, noiseFloor: 30 })

          // Safety timeout: if the recorder's silence detection doesn't fire,
          // close the window after CONVERSATION_WINDOW_MS
          conversationWindowRef.current = setTimeout(() => {
            clearConversationWindow()
          }, CONVERSATION_WINDOW_MS)
        }, 1500)
      }
    }, 100)
  }, [isSpeaking, clearConversationWindow])

  // Keep ref in sync so trainer_speak listener can open conversation window
  openConversationWindowRef.current = openConversationWindow

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

      // During conversation window, apply 3-layer echo filter
      if (wasInConversation) {
        const trimmed = text.trim().toLowerCase()
        const words = trimmed.split(/\s+/)

        // Layer 1 — Similarity check: compare against what JARVIS just said
        if (lastJarvisSpeechRef.current) {
          const jarvisWords = lastJarvisSpeechRef.current.toLowerCase().split(/\s+/)
          const overlap = words.filter((w: string) => jarvisWords.includes(w)).length
          const similarity = overlap / Math.max(words.length, 1)
          if (similarity > 0.4) {
            console.log('[JARVIS] Discarding echo (similarity %.0f%):', similarity * 100, text)
            return
          }
        }

        // Layer 2 — Common Whisper hallucination phrases
        const hallucinations = [
          'thank you for watching', 'bye bye', 'subscribe',
          'see you next time', 'thank you for listening',
          'thanks for watching', 'like and subscribe',
          'see you in the next', 'we are here to help',
        ]
        if (hallucinations.some((h) => trimmed.includes(h))) {
          console.log('[JARVIS] Discarding hallucination phrase:', text)
          return
        }

        // Layer 3 — Short + not a question = likely noise/echo
        const isQuestion = /\?/.test(trimmed) || /^(what|where|how|why|when|who|can|could|should|is|are|do|does|will|would)\b/.test(trimmed)
        if (words.length <= 4 && !isQuestion) {
          console.log('[JARVIS] Discarding short non-question in conversation window:', text)
          return
        }
      }

      console.log('[JARVIS] Transcribed:', text)
      broadcastConversation('player', text)
      const reply = await processTranscript(text)
      if (reply) {
        lastJarvisSpeechRef.current = reply
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
    noiseFloor: 25,
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
