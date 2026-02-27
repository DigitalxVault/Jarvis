'use client'

import { useEffect, useState } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { metresToFeet, latToDMS, lonToDMS } from '@/lib/conversions'

interface BottomBarProps {
  connectionState: ConnectionState
  telemetry?: TelemetryPacket | null
}

export function BottomBar({ connectionState, telemetry }: BottomBarProps) {
  const [uptime, setUptime] = useState('00:00:00')
  const [uptimeSec, setUptimeSec] = useState(0)

  useEffect(() => {
    const interval = setInterval(() => {
      setUptimeSec((s) => {
        const next = s + 1
        const h = String(Math.floor(next / 3600)).padStart(2, '0')
        const m = String(Math.floor((next % 3600) / 60)).padStart(2, '0')
        const sec = String(next % 60).padStart(2, '0')
        setUptime(`${h}:${m}:${sec}`)
        return next
      })
    }, 1000)
    return () => clearInterval(interval)
  }, [])

  // Navigation data
  const lat = telemetry?.pos?.lat ? latToDMS(telemetry.pos.lat) : '--°--\'--"N'
  const lon = telemetry?.pos?.lon ? lonToDMS(telemetry.pos.lon) : '---°--\'--"E'
  const agl = telemetry?.pos?.alt_agl_m
    ? Math.round(metresToFeet(telemetry.pos.alt_agl_m)).toLocaleString()
    : '---'

  const statusColor = connectionState === 'connected'
    ? 'text-jarvis-success glow-success'
    : connectionState === 'offline'
      ? 'text-jarvis-danger glow-danger'
      : 'text-jarvis-warning'

  const statusLabel = connectionState === 'connected'
    ? '● JARVIS ONLINE'
    : connectionState === 'offline'
      ? '● JARVIS OFFLINE'
      : '● JARVIS STANDBY'

  return (
    <div
      className="bg-jarvis-bar border-t border-jarvis-border flex items-center justify-between px-4 h-[50px] text-[11px]"
      style={{ letterSpacing: '0.5px' }}
    >
      {/* Position data */}
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-2">
          <span className="opacity-45">LAT</span>
          <span className="text-jarvis-accent tabular-nums">{lat}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-45">LON</span>
          <span className="text-jarvis-accent tabular-nums">{lon}</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="opacity-45">AGL</span>
          <span className="text-jarvis-accent tabular-nums">{agl} FT</span>
        </div>
      </div>

      {/* Ticker */}
      <div className="flex-1 mx-6 overflow-hidden whitespace-nowrap">
        <div className="inline-block ticker-scroll text-jarvis-primary/60">
          {/* eslint-disable-next-line react/jsx-no-comment-textnodes */}
          // JARVIS DCS TACTICAL HUD v2.0 // EXPANDED TELEMETRY ACTIVE // SAFETY ALERTS ARMED // FLIGHT COACHING ENABLED //
        </div>
      </div>

      {/* Uptime + Status */}
      <div className="flex items-center gap-4">
        <span className="opacity-45">UPTIME</span>
        <span className="text-jarvis-accent glow-accent tabular-nums">{uptime}</span>
        <span className={`${statusColor} animate-blink font-bold text-[10px]`}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}
