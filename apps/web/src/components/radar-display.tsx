'use client'

import { useRef, useEffect, useState } from 'react'

interface RadarDisplayProps {
  className?: string
}

export function RadarDisplay({ className = '' }: RadarDisplayProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [sweepAngle, setSweepAngle] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const cx = width / 2
    const cy = height / 2
    const maxRadius = Math.min(width, height) / 2 - 20

    // Animation frame
    let animationId: number
    const animate = () => {
      // Clear
      ctx.clearRect(0, 0, width, height)

      // Dark background
      ctx.fillStyle = '#000d1a'
      ctx.fillRect(0, 0, width, height)

      // Concentric range rings
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.2)'
      ctx.lineWidth = 1
      for (let i = 1; i <= 4; i++) {
        ctx.beginPath()
        ctx.arc(cx, cy, (maxRadius / 4) * i, 0, Math.PI * 2)
        ctx.stroke()
      }

      // Crosshairs
      ctx.beginPath()
      ctx.moveTo(cx - maxRadius, cy)
      ctx.lineTo(cx + maxRadius, cy)
      ctx.moveTo(cx, cy - maxRadius)
      ctx.lineTo(cx, cy + maxRadius)
      ctx.strokeStyle = 'rgba(0, 212, 255, 0.15)'
      ctx.stroke()

      // Sweep line with gradient trail
      const gradient = ctx.createConicGradient(
        sweepAngle - Math.PI / 2,
        cx,
        cy
      )
      gradient.addColorStop(0, 'rgba(0, 255, 255, 0)')
      gradient.addColorStop(0.85, 'rgba(0, 255, 255, 0)')
      gradient.addColorStop(1, 'rgba(0, 255, 255, 0.3)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.arc(cx, cy, maxRadius, sweepAngle - Math.PI * 0.3, sweepAngle)
      ctx.closePath()
      ctx.fill()

      // Bright sweep line
      ctx.strokeStyle = '#00ffff'
      ctx.lineWidth = 2
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 10
      ctx.beginPath()
      ctx.moveTo(cx, cy)
      ctx.lineTo(
        cx + Math.cos(sweepAngle - Math.PI / 2) * maxRadius,
        cy + Math.sin(sweepAngle - Math.PI / 2) * maxRadius
      )
      ctx.stroke()
      ctx.shadowBlur = 0

      // Range labels
      ctx.fillStyle = 'rgba(0, 212, 255, 0.4)'
      ctx.font = '9px "Courier New"'
      ctx.textAlign = 'center'
      ctx.fillText('10', cx + maxRadius / 4, cy + 12)
      ctx.fillText('20', cx + maxRadius / 2, cy + 12)
      ctx.fillText('30', cx + (maxRadius * 3) / 4, cy + 12)
      ctx.fillText('40', cx + maxRadius - 5, cy + 12)

      // Random blips (simulated contacts)
      const time = Date.now() / 1000
      const blips = [
        { angle: 0.5, dist: 0.6, phase: 0 },
        { angle: 2.1, dist: 0.35, phase: 1 },
        { angle: 4.0, dist: 0.8, phase: 2 },
      ]

      blips.forEach((blip) => {
        const opacity = Math.max(0, 1 - ((time * 2 + blip.phase) % 3) / 3)
        if (opacity > 0) {
          const bx = cx + Math.cos(blip.angle - Math.PI / 2) * maxRadius * blip.dist
          const by = cy + Math.sin(blip.angle - Math.PI / 2) * maxRadius * blip.dist

          ctx.fillStyle = `rgba(0, 255, 136, ${opacity * 0.8})`
          ctx.beginPath()
          ctx.arc(bx, by, 4, 0, Math.PI * 2)
          ctx.fill()

          // Blip label
          if (opacity > 0.5) {
            ctx.fillStyle = `rgba(0, 255, 136, ${opacity})`
            ctx.font = '8px "Courier New"'
            ctx.textAlign = 'left'
            ctx.fillText(`BUG ${blip.phase + 1}`, bx + 8, by + 3)
          }
        }
      })

      // Update sweep angle
      setSweepAngle((prev) => {
        const next = prev + 0.03
        return next > Math.PI * 2 ? 0 : next
      })

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => cancelAnimationFrame(animationId)
  }, [sweepAngle])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={320}
        height={320}
        className="rounded-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
