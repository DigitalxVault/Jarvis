'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  TelemetryPacket,
  HeartbeatPacket,
  TacticalPacket,
} from '@jarvis-dcs/shared'
import { MAX_RAW_PACKETS, STALENESS_TIMEOUT_MS } from '@jarvis-dcs/shared'

export type ConnectionState = 'connecting' | 'connected' | 'dcs_offline' | 'reconnecting' | 'offline'

interface TelemetryState {
  telemetry: TelemetryPacket | null
  heartbeat: HeartbeatPacket | null
  tactical: TacticalPacket | null
  connectionState: ConnectionState
  packetsPerSec: number
  lastPacketAt: number | null
  rawPackets: TelemetryPacket[]
  subscriptionStatus: string
  sessionEnded: boolean
}

export function useTelemetry(sessionId: string | null): TelemetryState {
  const [telemetry, setTelemetry] = useState<TelemetryPacket | null>(null)
  const [heartbeat, setHeartbeat] = useState<HeartbeatPacket | null>(null)
  const [tactical, setTactical] = useState<TacticalPacket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('idle')
  const [rawPackets, setRawPackets] = useState<TelemetryPacket[]>([])

  const [sessionEnded, setSessionEnded] = useState(false)

  const channelRef = useRef<RealtimeChannel | null>(null)
  const packetCountRef = useRef(0)
  const ppsRef = useRef(0)
  const lastPacketAtRef = useRef<number | null>(null)
  const lastHeartbeatAtRef = useRef<number | null>(null)
  const [packetsPerSec, setPacketsPerSec] = useState(0)
  const [lastPacketAt, setLastPacketAt] = useState<number | null>(null)

  // PPS counter — smoothed over 2 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      const pps = packetCountRef.current / 2
      ppsRef.current = pps
      setPacketsPerSec(pps)
      packetCountRef.current = 0
    }, 2000)
    return () => clearInterval(interval)
  }, [])

  // Staleness check
  useEffect(() => {
    const interval = setInterval(() => {
      // Telemetry staleness: connected → dcs_offline
      if (lastPacketAtRef.current && Date.now() - lastPacketAtRef.current > STALENESS_TIMEOUT_MS) {
        setConnectionState((prev) =>
          prev === 'connected' ? 'dcs_offline' : prev
        )
      }
      // Heartbeat staleness: dcs_offline → connecting (bridge died)
      if (lastHeartbeatAtRef.current && Date.now() - lastHeartbeatAtRef.current > STALENESS_TIMEOUT_MS) {
        setConnectionState((prev) =>
          prev === 'dcs_offline' ? 'connecting' : prev
        )
        setHeartbeat(null)
      }
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  const handleTelemetry = useCallback((msg: { payload: unknown }) => {
    const packet = msg.payload as TelemetryPacket
    setTelemetry(packet)
    packetCountRef.current++
    const now = Date.now()
    lastPacketAtRef.current = now
    setLastPacketAt(now)
    setConnectionState('connected')
    setRawPackets((prev) => {
      const next = [...prev, packet]
      return next.length > MAX_RAW_PACKETS ? next.slice(-MAX_RAW_PACKETS) : next
    })
  }, [])

  const handleHeartbeat = useCallback((msg: { payload: unknown }) => {
    const hb = msg.payload as HeartbeatPacket
    if (hb?.type !== 'heartbeat') return
    lastHeartbeatAtRef.current = Date.now()
    setHeartbeat(hb)
    // Don't immediately set dcs_offline on heartbeat — let the staleness
    // timer handle it. Heartbeat dcsActive can bounce during DCS pause/unpause
    // causing rapid connected↔dcs_offline flicker and repeated voice cues.
    // The 3s staleness timeout provides a natural debounce.
  }, [])

  const handleTactical = useCallback((msg: { payload: unknown }) => {
    const packet = msg.payload as TacticalPacket
    if (packet?.type !== 'tactical') return
    setTactical(packet)
  }, [])

  const handleSessionEnded = useCallback(() => {
    setSessionEnded(true)
  }, [])

  const handleStatus = useCallback((status: string) => {
    setSubscriptionStatus(status)
    if (status === 'SUBSCRIBED') {
      setConnectionState((prev) => (prev === 'connecting' ? 'connecting' : prev))
    }
    if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
      setConnectionState('reconnecting')
    }
    if (status === 'CLOSED') {
      setConnectionState('offline')
    }
  }, [])

  const setupChannel = useCallback((channelName: string) => {
    if (channelRef.current) {
      supabase.removeChannel(channelRef.current)
      channelRef.current = null
    }

    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'telemetry' }, handleTelemetry)
      .on('broadcast', { event: 'heartbeat' }, handleHeartbeat)
      .on('broadcast', { event: 'tactical' }, handleTactical)
      .on('broadcast', { event: 'session_ended' }, handleSessionEnded)
      .subscribe(handleStatus)

    channelRef.current = channel
    return channel
  }, [handleTelemetry, handleHeartbeat, handleTactical, handleSessionEnded, handleStatus])

  // Subscribe to channel
  useEffect(() => {
    if (!sessionId) {
      setConnectionState('offline')
      return
    }

    setConnectionState('connecting')
    setSubscriptionStatus('subscribing')
    setSessionEnded(false)

    const channelName = `session:${sessionId}`
    setupChannel(channelName)

    const handleVisibility = () => {
      if (!document.hidden) {
        setupChannel(channelName)
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
        channelRef.current = null
      }
    }
  }, [sessionId, setupChannel])

  return {
    telemetry,
    heartbeat,
    tactical,
    connectionState,
    packetsPerSec,
    lastPacketAt,
    rawPackets,
    subscriptionStatus,
    sessionEnded,
  }
}
