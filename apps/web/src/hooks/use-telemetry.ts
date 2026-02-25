'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type {
  TelemetryPacket,
  HeartbeatPacket,
  BroadcastPayload,
} from '@jarvis-dcs/shared'
import { MAX_RAW_PACKETS, STALENESS_TIMEOUT_MS } from '@jarvis-dcs/shared'

export type ConnectionState = 'connecting' | 'connected' | 'dcs_offline' | 'reconnecting' | 'offline'

interface TelemetryState {
  telemetry: TelemetryPacket | null
  heartbeat: HeartbeatPacket | null
  connectionState: ConnectionState
  packetsPerSec: number
  lastPacketAt: number | null
  rawPackets: TelemetryPacket[]
  subscriptionStatus: string
}

export function useTelemetry(sessionId: string | null): TelemetryState {
  const [telemetry, setTelemetry] = useState<TelemetryPacket | null>(null)
  const [heartbeat, setHeartbeat] = useState<HeartbeatPacket | null>(null)
  const [connectionState, setConnectionState] = useState<ConnectionState>('offline')
  const [subscriptionStatus, setSubscriptionStatus] = useState<string>('idle')
  const [rawPackets, setRawPackets] = useState<TelemetryPacket[]>([])

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

  // Subscribe to channel
  useEffect(() => {
    if (!sessionId) {
      setConnectionState('offline')
      return
    }

    setConnectionState('connecting')
    setSubscriptionStatus('subscribing')

    const channelName = `session:${sessionId}`
    const channel = supabase
      .channel(channelName)
      .on('broadcast', { event: 'telemetry' }, (msg) => {
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
      })
      .on('broadcast', { event: 'heartbeat' }, (msg) => {
        const hb = msg.payload as HeartbeatPacket
        if (hb?.type !== 'heartbeat') return
        lastHeartbeatAtRef.current = Date.now()
        setHeartbeat(hb)
        if (!hb.dcsActive) {
          setConnectionState('dcs_offline')
        }
      })
      .subscribe((status) => {
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
      })

    channelRef.current = channel

    // Tab visibility: unsubscribe when hidden, resubscribe when visible
    const handleVisibility = () => {
      if (document.hidden) {
        supabase.removeChannel(channel)
        channelRef.current = null
        setSubscriptionStatus('paused')
      } else {
        // Resubscribe by re-running this effect
        // We use a simple approach: remove and re-add
        const newChannel = supabase
          .channel(channelName)
          .on('broadcast', { event: 'telemetry' }, (msg) => {
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
          })
          .on('broadcast', { event: 'heartbeat' }, (msg) => {
            const hb = msg.payload as HeartbeatPacket
            if (hb?.type !== 'heartbeat') return
            lastHeartbeatAtRef.current = Date.now()
            setHeartbeat(hb)
            if (!hb.dcsActive) {
              setConnectionState('dcs_offline')
            }
          })
          .subscribe((status) => {
            setSubscriptionStatus(status)
          })
        channelRef.current = newChannel
      }
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      document.removeEventListener('visibilitychange', handleVisibility)
      if (channelRef.current) {
        supabase.removeChannel(channelRef.current)
      }
      channelRef.current = null
    }
  }, [sessionId])

  return {
    telemetry,
    heartbeat,
    connectionState,
    packetsPerSec,
    lastPacketAt,
    rawPackets,
    subscriptionStatus,
  }
}
