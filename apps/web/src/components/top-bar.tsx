'use client'

import { useEffect, useState } from 'react'
import { ConnectionStatus } from './connection-status'
import type { ConnectionState } from '@/hooks/use-telemetry'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { mpsToKnots, metresToFeet, formatHeading, radToDegSigned } from '@/lib/conversions'

interface TopBarProps {
  connectionState: ConnectionState
  telemetry: TelemetryPacket | null
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

  const ias = telemetry ? Math.round(mpsToKnots(telemetry.spd.ias_mps)) : '---'
  const alt = telemetry ? Math.round(metresToFeet(telemetry.pos.alt_m)).toLocaleString() : '---'
  const hdg = telemetry ? formatHeading(radToDegSigned(telemetry.hdg_rad)) : '---'
  const mach = telemetry?.spd.mach ? telemetry.spd.mach.toFixed(2) : '---'
  const aoa = telemetry?.aero?.aoa_rad ? Math.round(radToDegSigned(telemetry.aero.aoa_rad)) : '---'
  const gLoad = telemetry?.aero?.g?.y ? telemetry.aero.g.y.toFixed(1) : '---'

  // G-load color
  const gColor = telemetry && telemetry.aero?.g?.y
    ? telemetry.aero.g.y > 7
      ? 'text-jarvis-danger'
      : telemetry.aero.g.y > 5
        ? 'text-jarvis-warning'
        : telemetry.aero.g.y < -1
          ? 'text-jarvis-danger'
          : 'text-jarvis-accent'
    : 'text-jarvis-accent'

  return (
    <div
      className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-6 h-[60px]"
    >
      {/* Logo */}
      <div>
        <div className="text-[14px] font-bold glow-text" style={{ letterSpacing: '4px' }}>
          J·A·R·V·I·S
        </div>
        <div className="text-[10px] opacity-50" style={{ letterSpacing: '2px' }}>
          TACTICAL HUD v1.1
        </div>
      </div>

      {/* Quick stats - primary */}
      <div className="flex gap-4">
        <div className="text-center">
          <div className="text-lg font-bold text-jarvis-accent glow-accent tabular-nums">{ias}</div>
          <div className="text-[10px] opacity-50" style={{ letterSpacing: '1px' }}>IAS</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-jarvis-accent glow-accent tabular-nums">{alt}</div>
          <div className="text-[10px] opacity-50" style={{ letterSpacing: '1px' }}>ALT</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-jarvis-accent glow-accent tabular-nums">{hdg}°</div>
          <div className="text-[10px] opacity-50" style={{ letterSpacing: '1px' }}>HDG</div>
        </div>
      </div>

      {/* Quick stats - secondary */}
      <div className="flex gap-4">
        <div className="text-center">
          <div className="text-sm font-bold text-jarvis-primary tabular-nums">{mach}</div>
          <div className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>MACH</div>
        </div>
        <div className="text-center">
          <div className="text-sm font-bold text-jarvis-primary tabular-nums">{aoa}°</div>
          <div className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>AOA</div>
        </div>
        <div className="text-center">
          <div className={`text-sm font-bold tabular-nums ${gColor}`}>{gLoad}</div>
          <div className="text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>G</div>
        </div>
      </div>

      {/* Status + Clock */}
      <div className="flex items-center gap-4">
        <ConnectionStatus state={connectionState} />
        <div className="text-right">
          <div className="text-lg font-bold glow-text tabular-nums">{clock}</div>
          <div className="text-[10px] opacity-50" style={{ letterSpacing: '1px' }}>{date}</div>
        </div>
      </div>
    </div>
  )
}
