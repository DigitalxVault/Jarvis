'use client'

import { useEffect } from 'react'

interface ConfirmModalProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmModal({
  open,
  title,
  message,
  confirmLabel = 'CONFIRM',
  onConfirm,
  onCancel,
}: ConfirmModalProps) {
  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel()
    }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onCancel])

  if (!open) return null

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 9998,
        background: 'rgba(0,0,0,0.6)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
      onClick={onCancel}
    >
      {/* Modal body — stop propagation to avoid backdrop click */}
      <div
        className="jarvis-panel"
        style={{
          maxWidth: '320px',
          width: '90%',
          padding: '16px',
          border: '1px solid rgba(0, 212, 255, 0.4)',
          fontFamily: 'Courier New, monospace',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Title */}
        <div
          style={{
            fontSize: '10px',
            letterSpacing: '3px',
            color: '#00ffff',
            textTransform: 'uppercase',
            marginBottom: '10px',
          }}
        >
          {title}
        </div>

        {/* Message */}
        <div
          style={{
            fontSize: '9px',
            letterSpacing: '1px',
            color: 'rgba(0, 212, 255, 0.7)',
            marginBottom: '16px',
            lineHeight: '1.5',
          }}
        >
          {message}
        </div>

        {/* Buttons */}
        <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              background: 'none',
              border: '1px solid rgba(0, 212, 255, 0.2)',
              color: 'rgba(0, 212, 255, 0.4)',
              fontFamily: 'Courier New, monospace',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '5px 10px',
              cursor: 'pointer',
              transition: 'color 0.15s, border-color 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.color = 'rgba(0, 212, 255, 0.7)'
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.4)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.color = 'rgba(0, 212, 255, 0.4)'
              e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)'
            }}
          >
            CANCEL
          </button>

          <button
            onClick={onConfirm}
            style={{
              background: 'none',
              border: '1px solid rgba(0, 255, 255, 0.4)',
              color: '#00ffff',
              fontFamily: 'Courier New, monospace',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              padding: '5px 10px',
              cursor: 'pointer',
              transition: 'background 0.15s',
            }}
            onMouseEnter={e => {
              e.currentTarget.style.background = 'rgba(0, 255, 255, 0.08)'
            }}
            onMouseLeave={e => {
              e.currentTarget.style.background = 'none'
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
