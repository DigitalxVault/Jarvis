'use client'

import { useRef, useEffect } from 'react'

interface EnginePanelProps {
  rpmPct: number
  fuelCon: number
  className?: string
}

export function EnginePanel({ rpmPct, fuelCon, className = '' }: EnginePanelProps) {
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
    ctx.font = '8px "Courier New"'
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
        const labelR = radius - 20
        const lx = cx + Math.cos(angle) * labelR
        const ly = cy + Math.sin(angle) * labelR
        ctx.fillText(pct.toString(), lx, ly)
      }
    }

    // Center RPM value
    ctx.font = 'bold 20px "Courier New"'
    ctx.fillStyle = '#00ffff'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(Math.round(rpmPct).toString(), cx, cy - 5)

    ctx.font = '10px "Courier New"'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.6)'
    ctx.fillText('% RPM', cx, cy + 12)

    // Outer ring
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 2, 0, Math.PI * 2)
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1
    ctx.stroke()
  }, [rpmPct])

  return (
    <div className={className}>
      <div className="jarvis-panel p-1.5">
        <div className="panel-title">▸ ENGINE</div>

        <div className="flex flex-col items-center mt-1">
          {/* RPM gauge */}
          <canvas
            ref={canvasRef}
            width={120}
            height={56}
            style={{ imageRendering: 'pixelated' }}
          />

          {/* Fuel flow */}
          <div className="w-full mt-1 pt-1.5 border-t border-jarvis-border/30">
            <div className="flex justify-between items-center">
              <span className="text-[10px] opacity-50" style={{ letterSpacing: '2px' }}>
                FUEL FLOW
              </span>
              <span className="text-sm font-bold text-jarvis-accent glow-accent tabular-nums">
                {fuelCon > 0 ? fuelCon.toFixed(1) : '--.-'} <span className="text-[10px] opacity-60">PPH</span>
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
