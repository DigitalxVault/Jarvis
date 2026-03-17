'use client'

import { useState, useEffect, useRef } from 'react'
import { useTrainerComm } from '@/hooks/use-trainer-comm'
import { TrainerVoiceTab } from './trainer-voice-tab'
import { TrainerTextTab } from './trainer-text-tab'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

const INTENSITY_KEY = 'jarvis-trainer-rephrase-intensity'

type TabId = 'voice' | 'text' | 'templates'

interface TrainerCommPanelProps {
  sessionId: string
  telemetry: TelemetryPacket | null
  flightPhase: string
}

function intensityLabel(value: number): string {
  if (value === 0) return 'PASSTHROUGH (NO REPHRASE)'
  if (value < 0.25) return 'MINIMAL'
  if (value < 0.75) return 'MODERATE'
  return 'FULL JARVIS'
}

export function TrainerCommPanel({ sessionId, telemetry, flightPhase }: TrainerCommPanelProps) {
  const [activeTab, setActiveTab] = useState<TabId>('voice')
  const [showSettings, setShowSettings] = useState(false)
  const settingsRef = useRef<HTMLDivElement>(null)

  // Load rephrase intensity from localStorage
  const [rephraseIntensity, setRephraseIntensity] = useState<number>(() => {
    if (typeof window === 'undefined') return 0.5
    const stored = localStorage.getItem(INTENSITY_KEY)
    if (stored !== null) {
      const val = parseFloat(stored)
      if (!isNaN(val)) return Math.max(0, Math.min(1, val))
    }
    return 0.5
  })

  const handleIntensityChange = (value: number) => {
    const clamped = Math.max(0, Math.min(1, value))
    setRephraseIntensity(clamped)
    if (typeof window !== 'undefined') {
      localStorage.setItem(INTENSITY_KEY, String(clamped))
    }
  }

  // Close settings dropdown on outside click
  useEffect(() => {
    if (!showSettings) return
    const handleClickOutside = (e: MouseEvent) => {
      if (settingsRef.current && !settingsRef.current.contains(e.target as Node)) {
        setShowSettings(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showSettings])

  const {
    stage,
    elapsedMs,
    errorMessage,
    analyserRef,
    toggleRecording,
    sendText,
  } = useTrainerComm({
    sessionId,
    telemetry,
    flightPhase,
    rephraseIntensity,
  })

  const tabs: { id: TabId; label: string }[] = [
    { id: 'voice', label: 'VOICE' },
    { id: 'text', label: 'TEXT' },
    { id: 'templates', label: 'TEMPLATES' },
  ]

  return (
    <div
      className="jarvis-panel relative"
      style={{
        height: '180px',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Tab bar */}
      <div
        className="flex items-center border-b border-jarvis-primary/20 relative"
        style={{ height: '28px' }}
      >
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex items-center justify-center h-full px-4 transition-colors relative
              ${activeTab === tab.id
                ? 'text-jarvis-accent'
                : 'text-jarvis-primary/40 hover:text-jarvis-primary/70'
              }
            `}
            style={{
              fontSize: '9px',
              letterSpacing: '2px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
            }}
          >
            {tab.label}
            {/* Active underline */}
            {activeTab === tab.id && (
              <span
                className="absolute bottom-0 left-0 right-0"
                style={{
                  height: '2px',
                  background: '#00ffff',
                }}
              />
            )}
          </button>
        ))}

        {/* Spacer */}
        <div className="flex-1" />

        {/* Settings gear — relative container for dropdown */}
        <div ref={settingsRef} className="relative">
          <button
            onClick={() => setShowSettings(prev => !prev)}
            className="flex items-center justify-center text-jarvis-primary/40 hover:text-jarvis-primary/70 transition-colors"
            style={{
              width: '28px',
              height: '28px',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '14px',
            }}
            title="Rephrase settings"
          >
            ⚙
          </button>

          {/* Settings dropdown */}
          {showSettings && (
            <div
              className="absolute right-0 top-full mt-1 jarvis-panel border border-jarvis-primary/40 z-50"
              style={{
                width: '220px',
                padding: '10px 12px',
              }}
            >
              <div
                className="text-jarvis-primary/60 mb-2"
                style={{ fontSize: '8px', letterSpacing: '2px' }}
              >
                REPHRASE INTENSITY
              </div>

              <input
                type="range"
                min="0"
                max="1"
                step="0.1"
                value={rephraseIntensity}
                onChange={(e) => handleIntensityChange(parseFloat(e.target.value))}
                className="w-full mb-2"
                style={{ accentColor: '#00ffff' }}
              />

              <div
                className="text-jarvis-accent text-center"
                style={{ fontSize: '9px', letterSpacing: '2px' }}
              >
                {intensityLabel(rephraseIntensity)}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Tab content */}
      <div style={{ height: 'calc(100% - 28px)', overflow: 'hidden' }}>
        {activeTab === 'voice' && (
          <TrainerVoiceTab
            stage={stage}
            elapsedMs={elapsedMs}
            errorMessage={errorMessage}
            analyserRef={analyserRef}
            onToggleRecording={toggleRecording}
          />
        )}
        {activeTab === 'text' && (
          <TrainerTextTab
            stage={stage}
            onSendText={sendText}
          />
        )}
        {activeTab === 'templates' && (
          <div
            className="flex items-center justify-center h-full text-jarvis-primary/30"
            style={{ fontSize: '9px', letterSpacing: '2px' }}
          >
            TEMPLATES — COMING SOON
          </div>
        )}
      </div>
    </div>
  )
}
