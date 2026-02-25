'use client'

import { useRef, useEffect } from 'react'
import { mpsToFpm } from '@/lib/conversions'

interface VVITapeProps {
  vviMps: number
  className?: string
}

export function VVITape({ vviMps, className = '' }: VVITapeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const cx = width / 2
    const cy = height / 2

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Dark background
    ctx.fillStyle = '#000d1a'
    ctx.fillRect(0, 0, width, height)

    const vviFpm = mpsToFpm(vviMps)
    const range = 12000 // ±6000 fpm total range
    const pixelsPerFpm = (height - 30) / range

    // Draw zone backgrounds
    // Green zone ±500 fpm
    ctx.fillStyle = 'rgba(0, 255, 136, 0.1)'
    const greenTop = cy - 500 * pixelsPerFpm
    const greenBottom = cy + 500 * pixelsPerFpm
    ctx.fillRect(15, greenTop, width - 30, greenBottom - greenTop)

    // Draw tick marks
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)'
    ctx.font = '9px "Courier New"'
    ctx.textAlign = 'left'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1

    for (let fpm = -6000; fpm <= 6000; fpm += 500) {
      const y = cy - fpm * pixelsPerFpm
      if (y < 10 || y > height - 10) continue

      const isMajor = fpm % 1000 === 0
      const tickWidth = isMajor ? 12 : 6

      // Right side ticks
      ctx.beginPath()
      ctx.moveTo(cx + 20, y)
      ctx.lineTo(cx + 20 + tickWidth, y)
      ctx.strokeStyle = isMajor ? 'rgba(0, 212, 255, 0.6)' : 'rgba(0, 212, 255, 0.3)'
      ctx.stroke()

      // Labels on major marks
      if (isMajor) {
        const label = fpm >= 0 ? `+${fpm / 1000}` : `${fpm / 1000}`
        ctx.fillText(label, cx + 36, y)
      }
    }

    // Zero reference line (level flight)
    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(15, cy)
    ctx.lineTo(width - 15, cy)
    ctx.stroke()

    // Current VVI indicator (extends from center)
    const indicatorY = cy - vviFpm * pixelsPerFpm
    const clampedY = Math.max(10, Math.min(height - 10, indicatorY))

    // Determine color based on rate
    const absVvi = Math.abs(vviFpm)
    const indicatorColor = absVvi > 4000
      ? '#ff4444'
      : absVvi > 2000
        ? '#ffaa00'
        : '#00ffff'

    // Draw connecting line from center to indicator
    if (Math.abs(vviFpm) > 100) {
      ctx.strokeStyle = indicatorColor
      ctx.lineWidth = 3
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(cx, clampedY)
      ctx.stroke()
    }

    // Indicator triangle
    ctx.fillStyle = indicatorColor
    ctx.beginPath()
    ctx.moveTo(cx - 8, clampedY - 6)
    ctx.lineTo(cx + 8, clampedY - 6)
    ctx.lineTo(cx, clampedY + 6)
    ctx.closePath()
    ctx.fill()

    // Glow
    ctx.shadowColor = indicatorColor
    ctx.shadowBlur = 8
    ctx.fill()
    ctx.shadowBlur = 0

    // Center value display
    ctx.fillStyle = indicatorColor
    ctx.font = 'bold 16px "Courier New"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'

    const sign = vviFpm >= 0 ? '+' : ''
    const displayValue = `${sign}${Math.round(vviFpm)}`
    ctx.fillText(displayValue, cx, cy + 20)

    ctx.font = '9px "Courier New"'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)'
    ctx.fillText('FPM', cx, cy + 34)

    // Border
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1
    ctx.strokeRect(5, 5, width - 10, height - 10)
  }, [vviMps])

  return (
    <div className={className}>
      <div className="jarvis-panel">
        <div className="panel-title">▸ VERTICAL SPEED</div>
        <div className="flex justify-center mt-2">
          <canvas
            ref={canvasRef}
            width={90}
            height={150}
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>
    </div>
  )
}
