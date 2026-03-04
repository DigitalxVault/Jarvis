'use client'

import { useEffect, useState, useCallback } from 'react'

export function UpdateBanner() {
  const [showBanner, setShowBanner] = useState(false)
  const [waitingWorker, setWaitingWorker] = useState<ServiceWorker | null>(null)

  useEffect(() => {
    if (!('serviceWorker' in navigator)) return

    navigator.serviceWorker.ready.then((registration) => {
      // A waiting worker already exists (e.g. page was refreshed after install).
      if (registration.waiting) {
        setWaitingWorker(registration.waiting)
        setShowBanner(true)
      }

      // Watch for a new worker being installed in the background.
      registration.addEventListener('updatefound', () => {
        const newWorker = registration.installing
        if (!newWorker) return

        newWorker.addEventListener('statechange', () => {
          // Only show the banner when the new worker reaches 'installed' state
          // AND there is already an active controller (i.e. this is an update,
          // not the very first install).
          if (newWorker.state === 'installed' && navigator.serviceWorker.controller) {
            setWaitingWorker(newWorker)
            setShowBanner(true)
          }
        })
      })
    })
  }, [])

  // NOTE: We do NOT attach a 'controllerchange' listener here.
  // That event fires on ANY SW activation — including the first install with no
  // prior controller — which would cause an unwanted reload on first page load.
  // Instead, reload() is called directly inside handleUpdate after SKIP_WAITING.

  const handleUpdate = useCallback(() => {
    if (!waitingWorker) return
    waitingWorker.postMessage('SKIP_WAITING')
    window.location.reload()
  }, [waitingWorker])

  const handleDismiss = useCallback(() => {
    setShowBanner(false)
  }, [])

  if (!showBanner) return null

  return (
    <div
      role="alert"
      className="fixed top-0 left-0 right-0 z-[10000] flex items-center justify-between px-4 py-2"
      style={{
        background: 'linear-gradient(180deg, #001a2e 0%, #000d1a 100%)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.3)',
      }}
    >
      <span
        className="text-jarvis-primary text-xs font-bold"
        style={{ letterSpacing: '1.5px' }}
      >
        // NEW VERSION AVAILABLE
      </span>
      <div className="flex items-center gap-3">
        <button
          onClick={handleDismiss}
          className="text-jarvis-muted hover:text-jarvis-primary text-xs transition-colors"
          style={{ letterSpacing: '1px' }}
        >
          LATER
        </button>
        <button
          onClick={handleUpdate}
          className="text-jarvis-accent hover:text-white text-xs font-bold px-3 py-1 border border-jarvis-accent/40 hover:border-jarvis-accent transition-all"
          style={{ letterSpacing: '1.5px' }}
        >
          UPDATE
        </button>
      </div>
    </div>
  )
}
