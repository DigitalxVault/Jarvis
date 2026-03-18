'use client'

import { createContext, useContext, useState, useCallback, useRef } from 'react'

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type ToastType = 'success' | 'error' | 'info'

interface Toast {
  id: string
  message: string
  type: ToastType
  /** True once the fade-out animation starts */
  fading: boolean
}

interface ToastContextValue {
  showToast: (message: string, type?: ToastType) => void
}

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

const ToastContext = createContext<ToastContextValue | null>(null)

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) throw new Error('useToast must be used within a ToastProvider')
  return ctx
}

// ---------------------------------------------------------------------------
// Colors per type
// ---------------------------------------------------------------------------

const BORDER_COLOR: Record<ToastType, string> = {
  success: '#00ff88',
  error: '#ff4444',
  info: '#00ffff',
}

const TEXT_COLOR: Record<ToastType, string> = {
  success: '#00ff88',
  error: '#ff4444',
  info: '#00d4ff',
}

const MAX_TOASTS = 3
const AUTO_DISMISS_MS = 4000
const FADE_DURATION_MS = 400

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timersRef = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map())

  const removeToast = useCallback((id: string) => {
    setToasts(prev => prev.filter(t => t.id !== id))
    timersRef.current.delete(id)
  }, [])

  const startFade = useCallback(
    (id: string) => {
      setToasts(prev => prev.map(t => (t.id === id ? { ...t, fading: true } : t)))
      const timer = setTimeout(() => removeToast(id), FADE_DURATION_MS)
      timersRef.current.set(id, timer)
    },
    [removeToast]
  )

  const showToast = useCallback(
    (message: string, type: ToastType = 'info') => {
      const id = crypto.randomUUID()

      setToasts(prev => {
        // Enforce max toasts — drop oldest first
        const next = [...prev, { id, message, type, fading: false }]
        if (next.length > MAX_TOASTS) {
          const removed = next.splice(0, next.length - MAX_TOASTS)
          // Cancel timers for removed toasts
          removed.forEach(t => {
            const t1 = timersRef.current.get(t.id)
            if (t1) { clearTimeout(t1); timersRef.current.delete(t.id) }
          })
        }
        return next
      })

      // Auto-dismiss
      const timer = setTimeout(() => startFade(id), AUTO_DISMISS_MS)
      timersRef.current.set(id, timer)
    },
    [startFade]
  )

  return (
    <ToastContext.Provider value={{ showToast }}>
      {children}

      {/* Toast container — bottom-right */}
      <div
        style={{
          position: 'fixed',
          bottom: '16px',
          right: '16px',
          zIndex: 9999,
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          pointerEvents: 'none',
        }}
      >
        {toasts.map(toast => (
          <div
            key={toast.id}
            style={{
              background: '#000d1a',
              border: `1px solid ${BORDER_COLOR[toast.type]}`,
              padding: '8px 12px',
              fontFamily: 'Courier New, monospace',
              fontSize: '9px',
              letterSpacing: '2px',
              textTransform: 'uppercase',
              color: TEXT_COLOR[toast.type],
              maxWidth: '280px',
              opacity: toast.fading ? 0 : 1,
              transition: `opacity ${FADE_DURATION_MS}ms ease-out`,
              pointerEvents: 'auto',
              cursor: 'default',
            }}
            onClick={() => startFade(toast.id)}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}
