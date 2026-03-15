'use client'

import { useRef, useEffect } from 'react'

interface EnginePanelProps {
  rpmPct: number
  fuelCon: number
}

export function EnginePanel({ rpmPct, fuelCon }: EnginePanelProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) / 2 - 5

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Dark background
    ctx.fillStyle = '#000d1a'
    ctx.fillRect(0, 0, width, height)

    // RPM arc (220° sweep, from -160° to +60°)
    const startAngle = (-160 * Math.PI) / 180
    const endAngle = (60 * Math.PI) / 180
    const rpmRatio = Math.max(0, Math.min(100, rpmPct)) / 100
    const currentAngle = startAngle + (endAngle - startAngle) * rpmRatio

    // Background arc
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, endAngle)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)'
    ctx.lineWidth = 8
    ctx.stroke()

    // Active arc
    ctx.beginPath()
    ctx.arc(cx, cy, radius, startAngle, currentAngle)
    const gradient = ctx.createLinearGradient(0, cy + radius, 0, cy - radius)
    gradient.addColorStop(0, '#00ff88')
    gradient.addColorStop(0.5, '#00ffff')
    gradient.addColorStop(1, '#00d4ff')
    ctx.strokeStyle = gradient
    ctx.lineWidth = 8
    ctx.stroke()

    // Tick marks every 10%
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)'
    ctx.lineWidth = 1
    ctx.font = '12px "Courier New"'
    ctx.fillStyle = '#00d4ff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    for (let pct = 0; pct <= 100; pct += 10) {
      const ratio = pct / 100
      const angle = startAngle + (endAngle - startAngle) * ratio
      const innerR = radius - 12
      const outerR = radius - 5

      const x1 = cx + Math.cos(angle) * innerR
      const y1 = cy + Math.sin(angle) * innerR
      const x2 = cx + Math.cos(angle) * outerR
      const y2 = cy + Math.sin(angle) * outerR

      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()

      // Labels on 0, 50, 100
      if (pct % 50 === 0) {
        const labelR = radius - 24
        const lx = cx + Math.cos(angle) * labelR
        const ly = cy + Math.sin(angle) * labelR
        ctx.fillText(pct.toString(), lx, ly)
      }
    }

    // Center RPM value
    ctx.font = 'bold 42px "Courier New"'
    ctx.fillStyle = '#00ffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(Math.round(rpmPct).toString(), cx, cy - 8)

    ctx.font = '14px "Courier New"'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.6)'
    ctx.fillText('% RPM', cx, cy + 22)

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [rpmPct])

  return (
    <>
      <div className="hidden md:flex flex-col items-center mt-2">
        {/* RPM gauge */}
        <canvas
          ref={canvasRef}
          width={200}
          height={140}
          style={{ imageRendering: 'pixelated' }}
        />

        {/* Fuel flow */}
        <div className="w-full mt-2 pt-2 border-t border-jarvis-border/30">
          <div className="flex justify-between items-center">
            <span className="text-[13px] opacity-50" style={{ letterSpacing: '2px' }}>
              FUEL FLOW
            </span>
            <span className="text-xl font-bold text-jarvis-accent glow-accent tabular-nums">
              {fuelCon > 0 ? fuelCon.toFixed(1) : '--.-'} <span className="text-[13px] opacity-60">PPH</span>
            </span>
          </div>
        </div>
      </div>
      <div className="md:hidden jarvis-panel py-2 px-3">
        <div className="text-[11px] opacity-50 font-bold mb-1" style={{ letterSpacing: '2px' }}>ENGINE</div>
        <div className="flex justify-between items-baseline">
          <div>
            <span className="text-[11px] opacity-40">RPM </span>
            <span className={`text-[18px] font-bold tabular-nums ${
              rpmPct > 100 ? 'text-jarvis-danger' : rpmPct > 90 ? 'text-jarvis-warning' : 'text-jarvis-accent'
            }`}>
              {rpmPct.toFixed(0)}%
            </span>
          </div>
          <div>
            <span className="text-[11px] opacity-40">FF </span>
            <span className="text-jarvis-accent text-[18px] font-bold tabular-nums">
              {fuelCon > 0 ? fuelCon.toFixed(1) : '--.-'}
            </span>
            <span className="text-[11px] opacity-40 ml-0.5">PPH</span>
          </div>
        </div>
      </div>
    </>
  )
}
