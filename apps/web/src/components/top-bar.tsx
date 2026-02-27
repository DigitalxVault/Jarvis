'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { ConnectionStatus } from './connection-status'
import type { ConnectionState } from '@/hooks/use-telemetry'

interface TopBarProps {
  connectionState: ConnectionState
}

export function TopBar({ connectionState }: TopBarProps) {
  const [clock, setClock] = useState('--:--:--')
  const [date, setDate] = useState('')
  const pathname = usePathname()

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

  const isMainDash = pathname === '/'
  const isTactical = pathname === '/tactical'

  return (
    <div
      className="bg-jarvis-bar border-b border-jarvis-border flex items-center justify-between px-6 h-[52px]"
    >
      {/* Logo */}
      <div>
        <div className="text-[14px] font-bold glow-text" style={{ letterSpacing: '4px' }}>
          J·A·R·V·I·S
        </div>
        <div className="text-[10px] opacity-50" style={{ letterSpacing: '2px' }}>
          TACTICAL HUD v2.0
        </div>
      </div>

      {/* Navigation */}
      <div className="flex gap-2">
        <Link
          href="/"
          className={`px-4 py-1.5 text-[11px] font-bold border transition-all ${
            isMainDash
              ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
              : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
          }`}
          style={{ letterSpacing: '2px' }}
        >
          DASHBOARD
        </Link>
        <Link
          href="/tactical"
          className={`px-4 py-1.5 text-[11px] font-bold border transition-all ${
            isTactical
              ? 'border-jarvis-accent text-jarvis-accent glow-accent bg-jarvis-accent/10'
              : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary hover:text-jarvis-primary'
          }`}
          style={{ letterSpacing: '2px' }}
        >
          TACTICAL
        </Link>
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
