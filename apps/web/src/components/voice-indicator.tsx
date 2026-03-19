'use client'

import { useCallback, useState } from 'react'
import { useJarvisVoice } from '@/providers/jarvis-voice-provider'

/**
 * Compact voice status indicator for the top bar.
 * Clickable — requests mic permission and resumes AudioContext on first click.
 */
export function VoiceIndicator() {
  const { voiceState } = useJarvisVoice()
  const [micGranted, setMicGranted] = useState<boolean | null>(null)

  const configs: Record<string, { color: string; pulse: boolean; label: string }> = {
    idle: { color: 'text-jarvis-muted', pulse: false, label: 'CLICK MIC' },
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

  const handleClick = useCallback(async () => {
    // Warm up AudioContext synchronously during the user gesture
    // so Porcupine and the audio recorder can create contexts later.
    try {
      const ctx = new AudioContext()
      if (ctx.state === 'suspended') ctx.resume()
      setTimeout(() => ctx.close(), 100)
    } catch { /* non-fatal */ }

    try {
      // Request mic permission explicitly — this is the user gesture Chrome needs
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      // Stop the stream immediately — we just needed the permission grant
      stream.getTracks().forEach(t => t.stop())
      setMicGranted(true)
      console.log('[JARVIS] Mic permission granted')
    } catch (err) {
      console.error('[JARVIS] Mic permission denied:', err)
      setMicGranted(false)
    }
  }, [])

  return (
    <button
      onClick={handleClick}
      className="flex items-center gap-1.5 cursor-pointer hover:opacity-80 transition-opacity"
      title={`Voice: ${config.label}${voiceState === 'idle' ? ' — Click to enable mic' : ''}`}
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
