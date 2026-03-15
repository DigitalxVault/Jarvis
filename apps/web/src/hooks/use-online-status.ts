'use client'

import { useState, useEffect, useRef } from 'react'

/**
 * Returns true when the device has network access, false when offline.
 *
 * - Going offline is immediate (no debounce) — banner appears instantly.
 * - Going online is debounced by 2000ms to prevent flicker during brief
 *   network flaps (e.g. a mobile handoff between WiFi and cellular).
 *
 * Uses only window `online`/`offline` events — no polling or
 * navigator.connection API.
 */
export function useOnlineStatus(): boolean {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  )
  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    function handleOffline() {
      // Clear any pending recovery timer — network dropped again before
      // the debounce window elapsed.
      if (recoveryTimerRef.current !== null) {
        clearTimeout(recoveryTimerRef.current)
        recoveryTimerRef.current = null
      }
      setIsOnline(false)
    }

    function handleOnline() {
      // Debounce recovery by 2s to prevent banner flicker during flaps.
      recoveryTimerRef.current = setTimeout(() => {
        recoveryTimerRef.current = null
        setIsOnline(true)
      }, 2000)
    }

    window.addEventListener('offline', handleOffline)
    window.addEventListener('online', handleOnline)

    return () => {
      window.removeEventListener('offline', handleOffline)
      window.removeEventListener('online', handleOnline)
      if (recoveryTimerRef.current !== null) {
        clearTimeout(recoveryTimerRef.current)
      }
    }
  }, [])

  return isOnline
}
