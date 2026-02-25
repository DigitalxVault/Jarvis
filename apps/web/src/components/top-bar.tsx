'use client'

import { useEffect, useState } from 'react'
import { ConnectionStatus } from './connection-status'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

interface TopBarProps {
  connectionState: ConnectionState
  telemetry: TelemetryPacket | null
}

/** Convert m/s to knots */
function mpsToKnots(mps: number): string {
  return Math.round(mps * 1.944).toString()
}

/** Convert metres to feet */
function metresToFeet(m: number): string {
  return Math.round(m * 3.281).toLocaleString()
}

/** Convert radians to degrees */
function radToDeg(rad: number): string {
  let deg = (rad * 57.2958) % 360
  if (deg < 0) deg += 360
  return Math.round(deg).toString().padStart(3, '0')
}

export function TopBar({ connectionState, telemetry }: TopBarProps) {
  const [clock, setClock] = useState('--:--:--')
  const [date, setDate] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      setClock(now.toTimeString().slice(0, 8))
      setDate(now.toDateString().toUpperCase())
    }
    tick()
    const interval = setInterval(tick, 1000)
    return () => clearInterval(interval)
  }, [])

  const ias = telemetry ? mpsToKnots(telemetry.spd.ias_mps) : '---'
  const alt = telemetry ? metresToFeet(telemetry.pos.alt_m) : '---'
  const hdg = telemetry ? radToDeg(telemetry.hdg_rad) : '---'

  return (
    <div
      className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-5 h-[55px]"
    >
      {/* Logo */}
      <div>
        <div className="text-[13px] font-bold glow-text" style={{ letterSpacing: '5px' }}>
          J·A·R·V·I·S
        </div>
        <div className="text-[8px] opacity-50" style={{ letterSpacing: '3px' }}>
          DCS TELEMETRY // PHASE 1
        </div>
      </div>

      {/* Quick stats */}
      <div className="flex gap-6">
        <div className="text-center">
          <div className="text-xl font-bold text-jarvis-accent glow-accent tabular-nums">{ias}</div>
          <div className="text-[8px] opacity-50" style={{ letterSpacing: '2px' }}>IAS (KT)</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-jarvis-accent glow-accent tabular-nums">{alt}</div>
          <div className="text-[8px] opacity-50" style={{ letterSpacing: '2px' }}>ALT (FT)</div>
        </div>
        <div className="text-center">
          <div className="text-xl font-bold text-jarvis-accent glow-accent tabular-nums">{hdg}°</div>
          <div className="text-[8px] opacity-50" style={{ letterSpacing: '2px' }}>HDG</div>
        </div>
      </div>

      {/* Status + Clock */}
      <div className="flex items-center gap-6">
        <ConnectionStatus state={connectionState} />
        <div className="text-right">
          <div className="text-xl font-bold glow-text tabular-nums">{clock}</div>
          <div className="text-[8px] opacity-50" style={{ letterSpacing: '2px' }}>{date}</div>
        </div>
      </div>
    </div>
  )
}
