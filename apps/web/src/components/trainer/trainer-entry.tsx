'use client'

import { useState, useRef } from 'react'

interface TrainerEntryProps {
  onResolved: (sessionId: string, role?: 'controller' | 'observer') => void
  /** Error message to display when an observer deep-link fails validation */
  observerJoinError?: string
}

type EntryState = 'idle' | 'submitting' | 'error'

export function TrainerEntry({ onResolved, observerJoinError }: TrainerEntryProps) {
  const [code, setCode] = useState('')
  const [entryState, setEntryState] = useState<EntryState>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    const trimmed = code.trim()
    if (!/^\d{4}$/.test(trimmed)) {
      setErrorMessage('Invalid code format')
      setEntryState('error')
      return
    }

    setEntryState('submitting')
    setErrorMessage(null)

    try {
      const res = await fetch('/api/trainer/claim', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: trimmed }),
      })

      const data = await res.json()

      if (res.status === 200) {
        onResolved(data.sessionId as string, (data.role as 'controller' | 'observer') || 'controller')
        return
      }

      if (res.status === 404) {
        setErrorMessage('Session not found')
      } else if (res.status === 400) {
        setErrorMessage('Invalid code format')
      } else if (res.status === 429) {
        setErrorMessage('Too many attempts — wait a minute')
      } else {
        setErrorMessage('Connection error — try again')
      }
      setEntryState('error')
    } catch {
      setErrorMessage('Connection error — try again')
      setEntryState('error')
    }
  }

  function handleCodeChange(e: React.ChangeEvent<HTMLInputElement>) {
    const val = e.target.value.replace(/\D/g, '').slice(0, 4)
    setCode(val)
    if (entryState === 'error') {
      setEntryState('idle')
      setErrorMessage(null)
    }
  }

  const isSubmitting = entryState === 'submitting'

  return (
    <div
      className="min-h-screen bg-jarvis-bg flex items-center justify-center"
      style={{ fontFamily: 'Courier New, monospace' }}
    >
      <div className="jarvis-panel relative w-full max-w-sm mx-4">
        {/* Corner brackets */}
        <div className="corner-bracket corner-tl" />
        <div className="corner-bracket corner-tr" />
        <div className="corner-bracket corner-bl" />
        <div className="corner-bracket corner-br" />

        <div className="text-center mb-8">
          <div
            className="text-jarvis-accent mb-1"
            style={{ fontSize: '10px', letterSpacing: '4px' }}
          >
            J·A·R·V·I·S
          </div>
          <div
            className="text-jarvis-primary"
            style={{ fontSize: '14px', letterSpacing: '3px' }}
          >
            TRAINER VIEW
          </div>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-6">
            <label
              htmlFor="trainer-code"
              className="block text-jarvis-accent mb-2"
              style={{ fontSize: '9px', letterSpacing: '3px' }}
            >
              ENTER TRAINER CODE
            </label>

            <input
              ref={inputRef}
              id="trainer-code"
              type="text"
              inputMode="numeric"
              autoFocus
              autoComplete="off"
              maxLength={4}
              value={code}
              onChange={handleCodeChange}
              disabled={isSubmitting}
              placeholder="0000"
              className="w-full bg-transparent text-jarvis-primary text-center border border-jarvis-primary/40 focus:border-jarvis-primary focus:outline-none rounded-sm disabled:opacity-50"
              style={{
                fontSize: '32px',
                letterSpacing: '12px',
                padding: '12px 16px',
                caretColor: 'var(--color-jarvis-primary)',
              }}
            />

            {errorMessage && (
              <div
                className="mt-2 text-jarvis-danger text-center"
                style={{ fontSize: '10px', letterSpacing: '2px' }}
              >
                {errorMessage.toUpperCase()}
              </div>
            )}
          </div>

          <button
            type="submit"
            disabled={isSubmitting || code.length !== 4}
            className="w-full border border-jarvis-primary text-jarvis-primary hover:bg-jarvis-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            style={{ fontSize: '11px', letterSpacing: '3px', padding: '10px' }}
          >
            {isSubmitting ? 'CONNECTING...' : 'CONNECT'}
          </button>
        </form>

        {observerJoinError && (
          <div
            className="mt-4 text-center text-jarvis-danger border border-jarvis-danger/30 px-2 py-2"
            style={{ fontSize: '9px', letterSpacing: '2px' }}
          >
            {observerJoinError}
          </div>
        )}

        <div
          className="mt-6 text-center text-jarvis-primary/40"
          style={{ fontSize: '8px', letterSpacing: '2px' }}
        >
          REQUEST A 4-DIGIT CODE FROM THE PILOT
        </div>
      </div>
    </div>
  )
}
