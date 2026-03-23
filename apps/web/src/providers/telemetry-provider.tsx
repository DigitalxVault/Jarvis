'use client'

import { createContext, useContext, useState, useCallback } from 'react'
import { useTelemetry, type ConnectionState } from '@/hooks/use-telemetry'
import { useAlerts } from '@/hooks/use-alerts'
import { useAlertConfig } from '@/hooks/use-alert-config'
import { useCoaching } from '@/hooks/use-coaching'
import { useOnlineStatus } from '@/hooks/use-online-status'
import { useFlightPhase } from '@/hooks/use-flight-phase'
import { useCoachingConfig } from '@/hooks/use-coaching-config'
import type { FlightPhaseState } from '@/lib/flight-phases'
import type {
  Session,
  TelemetryPacket,
  TacticalPacket,
  HeartbeatPacket,
} from '@jarvis-dcs/shared'
import type { ActiveAlert } from '@jarvis-dcs/shared'

interface TelemetryContextValue {
  // Unlock gate
  isUnlocked: boolean
  setUnlocked: (v: boolean) => void
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
  // Flight phase
  flightPhase: FlightPhaseState
  // Network
  isNetworkOffline: boolean
}

const TelemetryContext = createContext<TelemetryContextValue | null>(null)

export function TelemetryProvider({ children }: { children: React.ReactNode }) {
  const isOnline = useOnlineStatus()
  const isNetworkOffline = !isOnline

  // Unlock gate: check sessionStorage on mount
  const [isUnlocked, setIsUnlockedState] = useState(() => {
    if (typeof window !== 'undefined') {
      return sessionStorage.getItem('jarvis_unlocked') === '1'
    }
    return false
  })

  const setUnlocked = useCallback((v: boolean) => {
    setIsUnlockedState(v)
    if (v) {
      sessionStorage.setItem('jarvis_unlocked', '1')
    } else {
      sessionStorage.removeItem('jarvis_unlocked')
    }
  }, [])

  const [currentSession, setCurrentSession] = useState<Session | null>(null)
  const [isCreating, setIsCreating] = useState(false)
  const [sessionError, setSessionError] = useState<string | null>(null)

  // Only subscribe to telemetry after START CODE is validated
  const sessionId = isUnlocked ? 'dev' : null
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

  const { rules: configuredRules } = useAlertConfig(sessionId)
  const { alerts, hasCritical, hasWarning } = useAlerts(telemetry, { rules: configuredRules })

  const coachingConfig = useCoachingConfig()

  const coaching = useCoaching(telemetry, coachingConfig)

  const flightPhase = useFlightPhase(telemetry)

  const handleCreateSession = useCallback(async () => {
    setIsCreating(true)
    setSessionError(null)
    try {
      const res = await fetch('/api/sessions', { method: 'POST' })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
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
      isUnlocked,
      setUnlocked,
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
      flightPhase,
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
