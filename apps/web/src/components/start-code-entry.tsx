'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName } from '@jarvis-dcs/shared'

interface StartCodeEntryProps {
  onUnlocked: () => void
}

export function StartCodeEntry({ onUnlocked }: StartCodeEntryProps) {
  const [digits, setDigits] = useState(['', '', '', ''])
  const [error, setError] = useState<string | null>(null)
  const [bridgeCode, setBridgeCode] = useState<string | null>(null)
  const [bridgeOnline, setBridgeOnline] = useState(false)
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])

  // Listen for bridge_start broadcasts on session:dev
  useEffect(() => {
    const channelName = getChannelName('dev')
    const ch = supabase.channel(`${channelName}:start_code`, {
      config: { broadcast: { ack: false } },
    })

    ch.on('broadcast', { event: 'bridge_start' }, (msg) => {
      const code = msg.payload?.code
      if (code && typeof code === 'string') {
        setBridgeCode(code)
        setBridgeOnline(true)
      }
    })

    ch.subscribe()

    return () => {
      supabase.removeChannel(ch)
    }
  }, [])

  const validate = useCallback((enteredCode: string) => {
    if (!bridgeCode) {
      setError('WAITING FOR BRIDGE')
      return
    }
    if (enteredCode === bridgeCode) {
      sessionStorage.setItem('jarvis_unlocked', '1')
      onUnlocked()
    } else {
      setError('INVALID CODE')
      // Clear after 2s
      setTimeout(() => setError(null), 2000)
    }
  }, [bridgeCode, onUnlocked])

  const handleChange = useCallback((index: number, value: string) => {
    // Only allow digits
    const digit = value.replace(/\D/g, '').slice(-1)
    setDigits(prev => {
      const next = [...prev]
      next[index] = digit
      return next
    })
    setError(null)

    if (digit && index < 3) {
      inputRefs.current[index + 1]?.focus()
    }

    // Auto-validate when all 4 digits entered
    if (digit && index === 3) {
      const allDigits = [...digits]
      allDigits[index] = digit
      const code = allDigits.join('')
      if (code.length === 4) {
        validate(code)
      }
    }
  }, [digits, validate])

  const handleKeyDown = useCallback((index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus()
    }
    if (e.key === 'Enter') {
      const code = digits.join('')
      if (code.length === 4) {
        validate(code)
      }
    }
  }, [digits, validate])

  const handlePaste = useCallback((e: React.ClipboardEvent) => {
    e.preventDefault()
    const pasted = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 4)
    if (pasted.length === 4) {
      const newDigits = pasted.split('')
      setDigits(newDigits)
      inputRefs.current[3]?.focus()
      validate(pasted)
    }
  }, [validate])

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus()
  }, [])

  return (
    <div className="fixed inset-0 flex items-center justify-center"
      style={{ backgroundColor: 'var(--color-jarvis-bg, #010a1a)' }}>
      <div className="flex flex-col items-center gap-8">
        {/* JARVIS logo text */}
        <div className="text-center">
          <h1 className="text-2xl tracking-[0.4em] font-bold"
            style={{ color: 'var(--color-jarvis-primary, #00d4ff)', fontFamily: 'Courier New, monospace' }}>
            J&middot;A&middot;R&middot;V&middot;I&middot;S
          </h1>
          <p className="text-xs tracking-[0.2em] mt-2 uppercase"
            style={{ color: 'var(--color-jarvis-accent, #00ffff)', opacity: 0.6 }}>
            DCS Telemetry System
          </p>
        </div>

        {/* Start code panel */}
        <div className="jarvis-panel p-8 flex flex-col items-center gap-6"
          style={{
            border: '1px solid var(--color-jarvis-primary, #00d4ff)',
            borderRadius: '4px',
            minWidth: '320px',
          }}>
          <p className="text-xs tracking-[0.3em] uppercase"
            style={{ color: 'var(--color-jarvis-primary, #00d4ff)' }}>
            ENTER START CODE
          </p>

          {/* 4-digit input */}
          <div className="flex gap-3" onPaste={handlePaste}>
            {digits.map((digit, i) => (
              <input
                key={i}
                ref={el => { inputRefs.current[i] = el }}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={digit}
                onChange={e => handleChange(i, e.target.value)}
                onKeyDown={e => handleKeyDown(i, e)}
                className="w-14 h-16 text-center text-2xl font-bold outline-none"
                style={{
                  backgroundColor: 'rgba(0, 212, 255, 0.05)',
                  border: `1px solid ${error ? 'var(--color-jarvis-danger, #ff4444)' : 'var(--color-jarvis-primary, #00d4ff)'}`,
                  borderRadius: '4px',
                  color: 'var(--color-jarvis-primary, #00d4ff)',
                  fontFamily: 'Courier New, monospace',
                  caretColor: 'var(--color-jarvis-accent, #00ffff)',
                }}
              />
            ))}
          </div>

          {/* Error message */}
          {error && (
            <p className="text-xs tracking-[0.2em] uppercase animate-blink"
              style={{ color: 'var(--color-jarvis-danger, #ff4444)' }}>
              {error}
            </p>
          )}

          {/* Bridge status */}
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full"
              style={{
                backgroundColor: bridgeOnline
                  ? 'var(--color-jarvis-success, #00ff88)'
                  : 'var(--color-jarvis-danger, #ff4444)',
              }}
            />
            <span className="text-xs tracking-[0.15em] uppercase"
              style={{
                color: bridgeOnline
                  ? 'var(--color-jarvis-success, #00ff88)'
                  : 'rgba(255,255,255,0.3)',
                fontFamily: 'Courier New, monospace',
              }}>
              {bridgeOnline ? 'BRIDGE ONLINE' : 'WAITING FOR BRIDGE'}
            </span>
          </div>
        </div>

        {/* Instructions */}
        <p className="text-xs text-center max-w-xs leading-relaxed"
          style={{
            color: 'rgba(255,255,255,0.3)',
            fontFamily: 'Courier New, monospace',
          }}>
          Start the JARVIS bridge on your DCS machine.
          Enter the 4-digit code shown in the bridge terminal.
        </p>
      </div>
    </div>
  )
}
