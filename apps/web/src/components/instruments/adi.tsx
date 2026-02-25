'use client'

import { useRef, useEffect } from 'react'

interface ADIProps {
  pitchRad: number
  bankRad: number
  className?: string
}

export function ADI({ pitchRad, bankRad, className = '' }: ADIProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const cx = width / 2
    const cy = height / 2
    const radius = Math.min(width, height) / 2 - 10

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Clip to circular instrument
    ctx.save()
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.clip()

    // Fill background (dark blue panel)
    ctx.fillStyle = '#000d1a'
    ctx.fillRect(0, 0, width, height)

    // Convert pitch to degrees, clamp to ±90°
    const pitchDeg = Math.max(-90, Math.min(90, pitchRad * 57.2958))
    const bankDeg = bankRad * 57.2958

    ctx.save()
    ctx.translate(cx, cy)
    ctx.rotate(-bankDeg * Math.PI / 180)

    // Sky (top half - lighter blue)
    ctx.fillStyle = 'rgba(0, 100, 150, 0.3)'
    ctx.fillRect(-radius, -radius, radius * 2, radius)

    // Ground (bottom half - darker brown/tan)
    ctx.fillStyle = 'rgba(120, 80, 40, 0.3)'
    ctx.fillRect(-radius, 0, radius * 2, radius)

    // Horizon line (bright cyan)
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(-radius, 0)
    ctx.lineTo(radius, 0)
    ctx.stroke()

    // Pitch ladder (5° increments)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.6)'
    ctx.lineWidth = 1
    ctx.font = '10px "Courier New"'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#00d4ff'

    const pixelsPerDegree = radius / 30
    const pitchOffset = pitchDeg * pixelsPerDegree

    for (let deg = -85; deg <= 85; deg += 5) {
      if (deg === 0) continue
      const y = -deg * pixelsPerDegree - pitchOffset
      if (y < -radius || y > radius) continue

      const isMajor = deg % 10 === 0
      const lineWidth = isMajor ? radius * 0.6 : radius * 0.25

      ctx.beginPath()
      ctx.moveTo(-lineWidth / 2, y)
      ctx.lineTo(lineWidth / 2, y)
      ctx.stroke()

      // Degree labels on major lines
      if (isMajor) {
        ctx.fillText(`${deg}°`, -radius * 0.7, y + 3)
        ctx.fillText(`${deg}°`, radius * 0.7, y + 3)
      }
    }

    ctx.restore()

    // Bank angle tick marks around circumference
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.4)'
    ctx.lineWidth = 1
    for (let deg = -180; deg <= 180; deg += 10) {
      if (deg === 0) continue
      const angle = (deg - 90) * Math.PI / 180
      const innerR = radius - 5
      const outerR = radius
      const x1 = cx + Math.cos(angle) * innerR
      const y1 = cy + Math.sin(angle) * innerR
      const x2 = cx + Math.cos(angle) * outerR
      const y2 = cy + Math.sin(angle) * outerR
      ctx.beginPath()
      ctx.moveTo(x1, y1)
      ctx.lineTo(x2, y2)
      ctx.stroke()
    }

    // Top index (wings level reference)
    ctx.strokeStyle = '#00ffff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(cx - 15, cy - radius + 15)
    ctx.lineTo(cx, cy - radius + 5)
    ctx.lineTo(cx + 15, cy - radius + 15)
    ctx.stroke()

    // Aircraft reference symbol (fixed "W" shape)
    ctx.strokeStyle = '#00ff88'
    ctx.lineWidth = 2
    ctx.beginPath()
    // Left wing
    ctx.moveTo(cx - 30, cy)
    ctx.lineTo(cx - 10, cy + 5)
    ctx.lineTo(cx - 10, cy)
    // Center
    ctx.lineTo(cx + 10, cy)
    ctx.lineTo(cx + 10, cy + 5)
    // Right wing
    ctx.lineTo(cx + 30, cy)
    ctx.stroke()

    // Bank angle indicator (pointer at top)
    ctx.fillStyle = '#00ffff'
    ctx.save()
    ctx.translate(cx, cy - radius + 12)
    ctx.rotate(bankRad)
    ctx.beginPath()
    ctx.moveTo(-5, 0)
    ctx.lineTo(0, -8)
    ctx.lineTo(5, 0)
    ctx.closePath()
    ctx.fill()
    ctx.restore()

    // Bank angle numeric
    ctx.font = 'bold 11px "Courier New"'
    ctx.textAlign = 'center'
    ctx.fillStyle = '#00ffff'
    const bankDisplay = Math.round(bankDeg)
    ctx.fillText(
      bankDisplay >= 0 ? `R ${bankDisplay}°` : `L ${Math.abs(bankDisplay)}°`,
      cx,
      cy + radius - 5
    )

    ctx.restore()

    // Outer ring
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.stroke()
  }, [pitchRad, bankRad])

  return (
    <canvas
      ref={canvasRef}
      width={200}
      height={200}
      className={className}
      style={{ imageRendering: 'pixelated' }}
    />
  )
}
