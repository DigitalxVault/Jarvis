'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useTelemetry, type ConnectionState } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useCoaching } from '@/hooks/use-coaching'
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
  handleDevMode: () => void
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
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  const sessionId = currentSession?.id ?? null
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

  const coaching = useCoaching(telemetry, {
    targetSpeedKnots: 350,
    speedTolerance: 50,
    targetAltFt: 25000,
    altTolerance: 200,
    targetHeadingDeg: 270,
    headingTolerance: 10,
  })

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

  const handleDevMode = useCallback(() => {
    setCurrentSession({
      id: 'dev',
      user_id: 'dev',
      status: 'active',
      pairing_code: null,
      pairing_expires_at: null,
      bridge_claimed: true,
      created_at: new Date().toISOString(),
      ended_at: null,
    })
  }, [])

  return (
    <TelemetryContext.Provider value={{
      currentSession,
      isCreating,
      sessionError,
      handleCreateSession,
      handleDevMode,
      clearSessionError: () => setSessionError(null),
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
