'use client'

import { useState, useCallback, useRef } from 'react'
import type { CommStage } from '@/hooks/use-trainer-comm'
import { ObserverGuard } from './observer-guard'
import { useTrainerRole } from './trainer-role-context'

interface TrainerTextTabProps {
  stage: CommStage
  onSendText: (text: string) => Promise<void>
}

function StageProgress({ stage, errorMessage }: { stage: CommStage; errorMessage?: string }) {
  if (stage === 'error') {
    return (
      <div
        className="text-jarvis-danger"
        style={{ fontSize: '9px', letterSpacing: '2px' }}
      >
        {errorMessage || 'ERROR'}
      </div>
    )
  }

  if (stage === 'rephrasing' || stage === 'speaking') {
    const label = stage === 'rephrasing' ? 'REPHRASING' : 'SPEAKING'
    return (
      <div
        className="text-jarvis-accent flex items-center gap-2"
        style={{ fontSize: '9px', letterSpacing: '2px' }}
      >
        <span className="inline-block w-1.5 h-1.5 rounded-full bg-jarvis-accent animate-pulse" />
        {label}...
      </div>
    )
  }

  return null
}

export function TrainerTextTab({ stage, onSendText }: TrainerTextTabProps) {
  const { isObserver } = useTrainerRole()
  const [text, setText] = useState('')
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const isIdle = stage === 'idle'
  const canSend = isIdle && text.trim().length > 0

  const handleSend = useCallback(async () => {
    if (!canSend) return
    const toSend = text.trim()
    setText('')
    await onSendText(toSend)
    textareaRef.current?.focus()
  }, [canSend, text, onSendText])

  const handleKeyDown = useCallback((e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
      e.preventDefault()
      if (!isObserver) handleSend()
    }
  }, [handleSend, isObserver])

  return (
    <ObserverGuard>
    <div className="flex flex-col gap-2 p-2 h-full">
      {/* Text input area */}
      <textarea
        ref={textareaRef}
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={handleKeyDown}
        disabled={!isIdle}
        rows={3}
        placeholder="Type message for Jarvis to speak..."
        className="w-full resize-none bg-jarvis-panel border border-jarvis-primary/30 text-jarvis-primary placeholder-jarvis-primary/30 focus:outline-none focus:border-jarvis-primary/60 disabled:opacity-50 disabled:cursor-not-allowed"
        style={{
          fontFamily: 'Courier New, monospace',
          fontSize: '10px',
          letterSpacing: '1px',
          borderRadius: '2px',
          padding: '6px 8px',
        }}
      />

      {/* Bottom row: stage progress + send button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex-1">
          <StageProgress stage={stage} />
        </div>

        <div className="flex flex-col items-end gap-1">
          <button
            onClick={handleSend}
            disabled={!canSend}
            className={`
              font-mono uppercase tracking-widest transition-all
              ${canSend
                ? 'bg-jarvis-bg border border-jarvis-accent text-jarvis-accent hover:bg-jarvis-accent/10 cursor-pointer'
                : 'bg-jarvis-bg border border-jarvis-primary/20 text-jarvis-primary/30 cursor-not-allowed'
              }
            `}
            style={{
              fontSize: '9px',
              letterSpacing: '3px',
              borderRadius: '2px',
              padding: '4px 12px',
            }}
          >
            SEND
          </button>
          <div
            className="text-jarvis-primary/30"
            style={{ fontSize: '8px', letterSpacing: '1px' }}
          >
            CTRL+ENTER
          </div>
        </div>
      </div>
    </div>
    </ObserverGuard>
  )
}
