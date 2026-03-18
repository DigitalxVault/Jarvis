'use client'

import { useState, useEffect, useRef } from 'react'
import { useTrainerComm } from '@/hooks/use-trainer-comm'
import { TrainerVoiceTab } from './trainer-voice-tab'
import { TrainerTextTab } from './trainer-text-tab'
import { TrainerTemplatesTab } from './trainer-templates-tab'
import { TrainerControlsTab } from './trainer-controls-tab'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

const INTENSITY_KEY = 'jarvis-trainer-rephrase-intensity'

/** Top-level panel tabs */
type TopTabId = 'comms' | 'controls' | 'alerts' | 'mission'

/** Sub-tabs within the COMMS panel */
type SubTabId = 'voice' | 'text' | 'templates'

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
  const [activeTop, setActiveTop] = useState<TopTabId>('comms')
  const [activeSub, setActiveSub] = useState<SubTabId>('voice')
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

  const topTabs: { id: TopTabId; label: string }[] = [
    { id: 'comms', label: 'COMMS' },
    { id: 'controls', label: 'CONTROLS' },
    { id: 'alerts', label: 'ALERTS' },
    { id: 'mission', label: 'MISSION' },
  ]

  const subTabs: { id: SubTabId; label: string }[] = [
    { id: 'voice', label: 'VOICE' },
    { id: 'text', label: 'TEXT' },
    { id: 'templates', label: 'TEMPLATES' },
  ]

  const TAB_BTN_STYLE = (active: boolean): React.CSSProperties => ({
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    height: '100%',
    padding: '0 12px',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    position: 'relative',
    fontSize: '9px',
    letterSpacing: '2px',
    color: active ? '#00ffff' : 'rgba(0, 212, 255, 0.4)',
    transition: 'color 0.15s',
  })

  return (
    <div
      className="jarvis-panel relative"
      style={{
        height: '220px',
        fontFamily: 'Courier New, monospace',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ---- Top-level tab bar ---- */}
      <div
        className="flex items-center border-b border-jarvis-primary/20 relative"
        style={{ height: '28px', flexShrink: 0 }}
      >
        {topTabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTop(tab.id)}
            style={TAB_BTN_STYLE(activeTop === tab.id)}
            onMouseEnter={e => {
              if (activeTop !== tab.id) {
                e.currentTarget.style.color = 'rgba(0, 212, 255, 0.7)'
              }
            }}
            onMouseLeave={e => {
              if (activeTop !== tab.id) {
                e.currentTarget.style.color = 'rgba(0, 212, 255, 0.4)'
              }
            }}
          >
            {tab.label}
            {activeTop === tab.id && (
              <span
                style={{
                  position: 'absolute',
                  bottom: 0,
                  left: 0,
                  right: 0,
                  height: '2px',
                  background: '#00ffff',
                }}
              />
            )}
          </button>
        ))}

        <div style={{ flex: 1 }} />

        {/* Settings gear — only visible on COMMS tab */}
        {activeTop === 'comms' && (
          <div ref={settingsRef} style={{ position: 'relative' }}>
            <button
              onClick={() => setShowSettings(prev => !prev)}
              style={{
                width: '28px',
                height: '28px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                fontSize: '14px',
                color: 'rgba(0, 212, 255, 0.4)',
                transition: 'color 0.15s',
              }}
              onMouseEnter={e => { e.currentTarget.style.color = 'rgba(0, 212, 255, 0.7)' }}
              onMouseLeave={e => { e.currentTarget.style.color = 'rgba(0, 212, 255, 0.4)' }}
              title="Rephrase settings"
            >
              ⚙
            </button>

            {showSettings && (
              <div
                className="absolute right-0 top-full mt-1 jarvis-panel border border-jarvis-primary/40 z-50"
                style={{ width: '220px', padding: '10px 12px' }}
              >
                <div style={{ fontSize: '8px', letterSpacing: '2px', color: 'rgba(0,212,255,0.6)', marginBottom: '8px' }}>
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
                <div style={{ fontSize: '9px', letterSpacing: '2px', color: '#00ffff', textAlign: 'center' }}>
                  {intensityLabel(rephraseIntensity)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ---- Tab content area ---- */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

        {/* COMMS — sub-tab system */}
        {activeTop === 'comms' && (
          <div style={{ height: '100%', display: 'flex', flexDirection: 'column' }}>
            {/* Sub-tab bar */}
            <div
              className="flex items-center border-b border-jarvis-primary/10"
              style={{ height: '24px', flexShrink: 0 }}
            >
              {subTabs.map(tab => (
                <button
                  key={tab.id}
                  onClick={() => setActiveSub(tab.id)}
                  style={{
                    ...TAB_BTN_STYLE(activeSub === tab.id),
                    fontSize: '8px',
                    height: '100%',
                    padding: '0 10px',
                  }}
                  onMouseEnter={e => {
                    if (activeSub !== tab.id) e.currentTarget.style.color = 'rgba(0, 212, 255, 0.7)'
                  }}
                  onMouseLeave={e => {
                    if (activeSub !== tab.id) e.currentTarget.style.color = 'rgba(0, 212, 255, 0.4)'
                  }}
                >
                  {tab.label}
                  {activeSub === tab.id && (
                    <span
                      style={{
                        position: 'absolute',
                        bottom: 0,
                        left: 0,
                        right: 0,
                        height: '1px',
                        background: 'rgba(0,255,255,0.5)',
                      }}
                    />
                  )}
                </button>
              ))}
            </div>

            {/* Sub-tab content */}
            <div style={{ flex: 1, overflow: 'hidden' }}>
              {activeSub === 'voice' && (
                <TrainerVoiceTab
                  stage={stage}
                  elapsedMs={elapsedMs}
                  errorMessage={errorMessage}
                  analyserRef={analyserRef}
                  onToggleRecording={toggleRecording}
                />
              )}
              {activeSub === 'text' && (
                <TrainerTextTab stage={stage} onSendText={sendText} />
              )}
              {activeSub === 'templates' && (
                <TrainerTemplatesTab
                  stage={stage}
                  telemetry={telemetry}
                  onSendText={sendText}
                />
              )}
            </div>
          </div>
        )}

        {/* CONTROLS tab */}
        {activeTop === 'controls' && (
          <TrainerControlsTab sessionId={sessionId} telemetry={telemetry} />
        )}

        {/* ALERTS placeholder */}
        {activeTop === 'alerts' && (
          <div
            style={{
              padding: '12px',
              fontSize: '8px',
              letterSpacing: '2px',
              color: 'rgba(0, 212, 255, 0.3)',
              textTransform: 'uppercase',
            }}
          >
            ALERTS — COMING IN 23-02
          </div>
        )}

        {/* MISSION placeholder */}
        {activeTop === 'mission' && (
          <div
            style={{
              padding: '12px',
              fontSize: '8px',
              letterSpacing: '2px',
              color: 'rgba(0, 212, 255, 0.3)',
              textTransform: 'uppercase',
            }}
          >
            MISSION — COMING IN 23-02
          </div>
        )}
      </div>
    </div>
  )
}
