'use client'

import { useEffect, useRef, useCallback } from 'react'

export function SwRegister() {
  const registrationRef = useRef<ServiceWorkerRegistration | null>(null)

  const registerSW = useCallback(async () => {
    if (!('serviceWorker' in navigator)) return

    // In development, unregister any existing SW to prevent stale cache interference
    if (process.env.NODE_ENV === 'development') {
      const registrations = await navigator.serviceWorker.getRegistrations()
      for (const r of registrations) {
        await r.unregister()
      }
      return
    }

    try {
      const registration = await navigator.serviceWorker.register('/sw.js', {
        updateViaCache: 'none',
      })
      registrationRef.current = registration

      // Poll for updates every 60 seconds so long-running sessions pick up
      // new SW versions without requiring a full page reload.
      setInterval(() => {
        registration.update()
      }, 60 * 1000)
    } catch (error) {
      console.error('[JARVIS] SW registration failed:', error)
    }
  }, [])

  useEffect(() => {
    registerSW()
  }, [registerSW])

  return null
}
