'use client'

import { createContext, useContext, useState, useCallback, useMemo } from 'react'
import { useTelemetry, type ConnectionState } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useCoaching } from '@/hooks/use-coaching'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type {
  Session,
  TelemetryPacket,
  TacticalPacket,
  HeartbeatPacket,
} from '@jarvis-dcs/shared'
import type { ActiveAlert } from '@jarvis-dcs/shared'

interface TelemetryContextValue {
  // Session
  currentSession: Session | null
  isCreating: boolean
  sessionError: string | null
  handleCreateSession: () => void
  clearSessionError: () => void
  // Telemetry
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
  heartbeat: HeartbeatPacket | null
  connectionState: ConnectionState
  packetsPerSec: number
  lastPacketAt: number | null
  rawPackets: TelemetryPacket[]
  subscriptionStatus: string
  // Alerts
  alerts: ActiveAlert[]
  hasCritical: boolean
  hasWarning: boolean
  // Coaching
  coaching: ReturnType<typeof useCoaching>
  // Network
  isNetworkOffline: boolean
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus()
  const isNetworkOffline = !isOnline

  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Auto-connect to session:dev when no explicit session exists
  const sessionId = currentSession?.id ?? 'dev'
  const {
    telemetry,
    tactical,
    heartbeat,
    connectionState,
    packetsPerSec,
    lastPacketAt,
    rawPackets,
    subscriptionStatus,
  } = useTelemetry(sessionId)

  const { alerts, hasCritical, hasWarning } = useAlerts(telemetry)

  const coachingOpts = useMemo(() => ({
    targetSpeedKnots: 350,
    speedTolerance: 50,
    targetAltFt: 25000,
    altTolerance: 200,
    targetHeadingDeg: 270,
    headingTolerance: 10,
  }), [])

  const coaching = useCoaching(telemetry, coachingOpts)

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true)
    setSessionError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        if (res.status === 401) {
          throw new Error('Sign in with Google to create a session')
        }
        throw new Error(data.error || `Failed (${res.status})`)
      }
      const session = await res.json()
      setCurrentSession(session)
    } catch (err) {
      console.error('Failed to create session:', err)
      setSessionError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setIsCreating(false)
    }
  }, [])

  const clearSessionError = useCallback(() => setSessionError(null), [])

  return (
    <TelemetryContext.Provider value={{
      currentSession,
      isCreating,
      sessionError,
      handleCreateSession,
      clearSessionError,
      telemetry,
      tactical,
      heartbeat,
      connectionState,
      packetsPerSec,
      lastPacketAt,
      rawPackets,
      subscriptionStatus,
      alerts,
      hasCritical,
      hasWarning,
      coaching,
      isNetworkOffline,
    }}>
      {children}
    </TelemetryContext.Provider>
  )
}

export function useTelemetryContext(): TelemetryContextValue {
  const ctx = useContext(TelemetryContext)
  if (!ctx) throw new Error('useTelemetryContext must be used within TelemetryProvider')
  return ctx
}
