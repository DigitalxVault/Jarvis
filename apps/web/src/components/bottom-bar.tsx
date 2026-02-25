'use client'

import { useEffect, useState } from 'react'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface BottomBarProps {
  connectionState: ConnectionState
}

export function BottomBar({ connectionState }: BottomBarProps) {
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
      className="bg-jarvis-bar border-t border-jarvis-border flex items-center justify-between px-5 h-[45px] text-[12px]"
      style={{ letterSpacing: '1px' }}
    >
      <div className="flex items-center gap-4">
        <span className="opacity-45">DCS</span>
        <span className="text-jarvis-accent glow-accent">WORLD</span>
      </div>

      {/* Ticker */}
      <div className="flex-1 mx-4 overflow-hidden whitespace-nowrap">
        <div className="inline-block ticker-scroll text-jarvis-primary/60">
          // JARVIS DCS TELEMETRY DASHBOARD // PHASE 1 PROTOTYPE // REALTIME BROADCAST VIA SUPABASE //
          UDP → BRIDGE → CLOUD → WEB // LATENCY TARGET &lt;500MS //
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="opacity-45">UPTIME</span>
        <span className="text-jarvis-accent glow-accent tabular-nums">{uptime}</span>
        <span className={`${statusColor} animate-blink font-bold`}>
          {statusLabel}
        </span>
      </div>
    </div>
  )
}
