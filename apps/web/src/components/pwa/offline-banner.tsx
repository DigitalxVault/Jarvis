'use client'

import { useState, useEffect, useRef } from 'react'
import { useOnlineStatus } from '@/hooks/use-online-status'

type Phase = 'hidden' | 'offline' | 'recovering'

/**
 * OfflineBanner — persistent network-loss indicator for JARVIS DCS.
 *
 * State machine:
 *   hidden    → offline    : network drops (isOnline false)
 *   offline   → recovering : network returns (isOnline true)
 *   recovering→ hidden     : 2500ms after recovery
 *
 * No dismiss button — flight safety requires persistent notification.
 * z-[10001] renders above UpdateBanner (z-[10000]).
 */
export function OfflineBanner() {
  const isOnline = useOnlineStatus()
  const [phase, setPhase] = useState<Phase>('hidden')
  const [attemptCount, setAttemptCount] = useState(0)
  const [fadingOut, setFadingOut] = useState(false)

  const recoveryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const fadeTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const attemptIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  // Stop attempt counter interval helper
  function clearAttemptInterval() {
    if (attemptIntervalRef.current !== null) {
      clearInterval(attemptIntervalRef.current)
      attemptIntervalRef.current = null
    }
  }

  // Stop recovery timer helper
  function clearRecoveryTimer() {
    if (recoveryTimerRef.current !== null) {
      clearTimeout(recoveryTimerRef.current)
      recoveryTimerRef.current = null
    }
    if (fadeTimerRef.current !== null) {
      clearTimeout(fadeTimerRef.current)
      fadeTimerRef.current = null
    }
  }

  useEffect(() => {
    if (!isOnline) {
      // Network dropped — go to (or stay in) offline phase immediately.
      clearRecoveryTimer()
      clearAttemptInterval()
      setFadingOut(false)
      setPhase('offline')
      setAttemptCount(1)

      // Increment attempt counter every 5 seconds while offline.
      attemptIntervalRef.current = setInterval(() => {
        setAttemptCount((c) => c + 1)
      }, 5000)
    } else {
      // Network recovered — only transition if we were showing the banner.
      if (phase === 'offline') {
        clearAttemptInterval()
        setPhase('recovering')

        // Start fade-out near the end of the 2500ms window (at 1800ms).
        fadeTimerRef.current = setTimeout(() => {
          setFadingOut(true)
        }, 1800)

        // Hide completely after 2500ms.
        recoveryTimerRef.current = setTimeout(() => {
          setPhase('hidden')
          setAttemptCount(0)
          setFadingOut(false)
        }, 2500)
      }
    }

    return () => {
      // Clean up interval on effect re-run (not unmount — unmount cleanup below).
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOnline])

  // Cleanup all timers on unmount.
  useEffect(() => {
    return () => {
      clearAttemptInterval()
      clearRecoveryTimer()
    }
  }, [])

  if (phase === 'hidden') return null

  const isOfflinePhase = phase === 'offline'

  return (
    <div
      role="alert"
      aria-live="assertive"
      className="fixed top-0 left-0 right-0 z-[10001] flex items-center justify-between px-4 py-2 transition-opacity duration-500"
      style={{
        background: isOfflinePhase
          ? 'linear-gradient(180deg, #1a0000 0%, #0d0000 100%)'
          : 'linear-gradient(180deg, #001a0a 0%, #000d05 100%)',
        borderBottom: isOfflinePhase
          ? '1px solid rgba(255, 68, 68, 0.4)'
          : '1px solid rgba(0, 255, 136, 0.4)',
        opacity: fadingOut ? 0 : 1,
      }}
    >
      {isOfflinePhase ? (
        <>
          {/* Left: spinning danger ring + CONNECTION LOST label */}
          <div className="flex items-center gap-2">
            <div className="relative flex items-center justify-center w-5 h-5">
              {/* Outer spinning ring */}
              <div
                className="absolute inset-0 rounded-full border-2 border-transparent animate-spin"
                style={{ borderTopColor: 'var(--color-jarvis-danger)' }}
              />
              {/* Inner static dot */}
              <div className="w-2 h-2 rounded-full bg-jarvis-danger" />
            </div>
            <span
              className="text-jarvis-danger text-xs font-bold"
              style={{ letterSpacing: '1.5px' }}
            >
              CONNECTION LOST
            </span>
          </div>

          {/* Right: reconnect attempt counter */}
          <span
            className="text-jarvis-muted text-xs"
            style={{ letterSpacing: '1px' }}
          >
            Reconnecting... (attempt {attemptCount})
          </span>
        </>
      ) : (
        <>
          {/* Left: static green dot + CONNECTED label */}
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-jarvis-success" />
            <span
              className="text-jarvis-success text-xs font-bold"
              style={{ letterSpacing: '1.5px' }}
            >
              CONNECTED
            </span>
          </div>

          {/* Right: resuming text */}
          <span
            className="text-jarvis-muted text-xs"
            style={{ letterSpacing: '1px' }}
          >
            Resuming...
          </span>
        </>
      )}
    </div>
  )
}
