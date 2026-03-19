'use client'

import { useCallback, useState, useEffect } from 'react'
import { useJarvisVoice } from '@/providers/jarvis-voice-provider'

/**
 * Compact voice status indicator for the top bar.
 * Shows mic/voice state. No longer requests mic permission on click —
 * Porcupine handles its own getUserMedia internally.
 */
export function VoiceIndicator() {
  const { voiceState } = useJarvisVoice()
  const [micGranted, setMicGranted] = useState<boolean | null>(null)

  // Check mic permission status without creating a stream
  useEffect(() => {
    if (typeof navigator === 'undefined' || !navigator.permissions) return
    navigator.permissions.query({ name: 'microphone' as PermissionName }).then((status) => {
      setMicGranted(status.state === 'granted')
      status.onchange = () => setMicGranted(status.state === 'granted')
    }).catch(() => {
      // Permissions API not supported — assume granted (Porcupine will handle it)
      setMicGranted(true)
    })
  }, [])

  const configs: Record<string, { color: string; pulse: boolean; label: string }> = {
    idle: { color: 'text-jarvis-muted', pulse: false, label: 'VOICE OFF' },
    listening: { color: 'text-jarvis-accent', pulse: false, label: 'LISTENING' },
    'wake-detected': { color: 'text-jarvis-success', pulse: true, label: 'JARVIS' },
    recording: { color: 'text-jarvis-danger', pulse: true, label: 'RECORDING' },
    processing: { color: 'text-jarvis-warning', pulse: true, label: 'THINKING' },
    speaking: { color: 'text-jarvis-success', pulse: true, label: 'SPEAKING' },
    error: { color: 'text-jarvis-danger', pulse: false, label: 'MIC ERR' },
    limit: { color: 'text-jarvis-warning', pulse: false, label: 'MIC IN USE' },
    'mic-denied': { color: 'text-jarvis-danger', pulse: false, label: 'MIC DENIED' },
  }

  const effectiveState = micGranted === false ? 'mic-denied' : voiceState
  const config = configs[effectiveState] || configs.idle

  // Click is now just a user gesture to unlock AudioContext — no stream creation
  const handleClick = useCallback(() => {
    try {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') ctx.resume()
      setTimeout(() => ctx.close(), 100)
    } catch { /* non-fatal */ }
  }, [])

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
      title={`Voice: ${config.label}`}
    >
      {/* Mic icon */}
      <div className={`relative ${config.color}`}>
        {config.pulse && (
          <div className={`absolute inset-0 rounded-full ${config.color} opacity-40 animate-ping`} />
        )}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="relative"
        >
          <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" />
          <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
          <line x1="12" x2="12" y1="19" y2="22" />
        </svg>
      </div>
      {/* Label — hidden on mobile */}
      <span
        className={`hidden md:inline text-[11px] font-bold ${config.color}`}
        style={{ letterSpacing: '1px' }}
      >
        {config.label}
      </span>
    </button>
  )
}
