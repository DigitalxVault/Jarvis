'use client'

import { useRef, useEffect, useState } from 'react'

interface JarvisLogoProps {
  className?: string
}

export function JarvisLogo({ className = '' }: JarvisLogoProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [time, setTime] = useState(0)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const cx = width / 2
    const cy = height / 2
    const baseRadius = Math.min(width, height) / 2 - 10

    let animationId: number
    const animate = () => {
      setTime((t) => t + 0.016)

      // Clear with dark background
      ctx.fillStyle = '#000d1a'
      ctx.fillRect(0, 0, width, height)

      const now = Date.now() / 1000

      // Outer ring - rotating slowly
      const outerAngle = now * 0.3
      ctx.strokeStyle = `rgba(0, 212, 255, ${0.3 + Math.sin(now * 2) * 0.1})`
      ctx.lineWidth = 2
      ctx.shadowColor = '#00d4ff'
      ctx.shadowBlur = 15
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius, 0, Math.PI * 2)
      ctx.stroke()
      ctx.shadowBlur = 0

      // Outer ring segments
      for (let i = 0; i < 8; i++) {
        const angle = outerAngle + (i * Math.PI * 2) / 8
        const x1 = cx + Math.cos(angle) * (baseRadius - 5)
        const y1 = cy + Math.sin(angle) * (baseRadius - 5)
        const x2 = cx + Math.cos(angle) * baseRadius
        const y2 = cy + Math.sin(angle) * baseRadius

        ctx.strokeStyle = '#00ffff'
        ctx.lineWidth = 3
        ctx.shadowColor = '#00ffff'
        ctx.shadowBlur = 10
        ctx.beginPath()
        ctx.moveTo(x1, y1)
        ctx.lineTo(x2, y2)
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // Middle ring - counter-rotating
      const middleAngle = -now * 0.5
      ctx.strokeStyle = `rgba(0, 255, 136, ${0.4 + Math.sin(now * 3) * 0.15})`
      ctx.lineWidth = 1.5
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius * 0.75, 0, Math.PI * 2)
      ctx.stroke()

      // Middle ring arc segments
      for (let i = 0; i < 6; i++) {
        const startAngle = middleAngle + (i * Math.PI * 2) / 6
        const endAngle = startAngle + Math.PI / 6
        ctx.strokeStyle = '#00ff88'
        ctx.lineWidth = 2
        ctx.shadowColor = '#00ff88'
        ctx.shadowBlur = 8
        ctx.beginPath()
        ctx.arc(cx, cy, baseRadius * 0.75, startAngle, endAngle)
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // Inner ring - pulsing
      const pulseScale = 1 + Math.sin(now * 4) * 0.05
      const innerRadius = baseRadius * 0.5 * pulseScale
      ctx.strokeStyle = `rgba(0, 212, 255, ${0.5 + Math.sin(now * 5) * 0.2})`
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.arc(cx, cy, innerRadius, 0, Math.PI * 2)
      ctx.stroke()

      // Core - glowing arc reactor
      const corePulse = 0.6 + Math.sin(now * 6) * 0.2
      const gradient = ctx.createRadialGradient(cx, cy, 0, cx, cy, baseRadius * 0.35)
      gradient.addColorStop(0, `rgba(0, 255, 255, ${corePulse})`)
      gradient.addColorStop(0.5, `rgba(0, 212, 255, ${corePulse * 0.6})`)
      gradient.addColorStop(1, 'rgba(0, 212, 255, 0)')

      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius * 0.35, 0, Math.PI * 2)
      ctx.fill()

      // Inner core circle
      ctx.fillStyle = `rgba(0, 255, 255, ${0.8 + Math.sin(now * 8) * 0.2})`
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 20
      ctx.beginPath()
      ctx.arc(cx, cy, baseRadius * 0.15, 0, Math.PI * 2)
      ctx.fill()
      ctx.shadowBlur = 0

      // Arc segments around core
      for (let i = 0; i < 3; i++) {
        const arcAngle = now * 2 + (i * Math.PI * 2) / 3
        ctx.strokeStyle = '#00d4ff'
        ctx.lineWidth = 2
        ctx.shadowColor = '#00d4ff'
        ctx.shadowBlur = 5
        ctx.beginPath()
        ctx.arc(cx, cy, baseRadius * 0.28, arcAngle, arcAngle + Math.PI / 4)
        ctx.stroke()
      }
      ctx.shadowBlur = 0

      // JARVIS text
      ctx.fillStyle = `rgba(0, 255, 255, ${0.7 + Math.sin(now * 2) * 0.15})`
      ctx.font = 'bold 14px "Courier New"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.shadowColor = '#00ffff'
      ctx.shadowBlur = 8
      ctx.fillText('JARVIS', cx, cy + baseRadius * 0.55)
      ctx.shadowBlur = 0

      // Small tech text below
      ctx.fillStyle = 'rgba(0, 212, 255, 0.4)'
      ctx.font = '8px "Courier New"'
      ctx.letterSpacing = '2px'
      ctx.fillText('TACTICAL INTERFACE', cx, cy + baseRadius * 0.7)

      animationId = requestAnimationFrame(animate)
    }

    animate()

    return () => cancelAnimationFrame(animationId)
  }, [])

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        width={200}
        height={200}
        className="rounded-full"
        style={{ imageRendering: 'pixelated' }}
      />
    </div>
  )
}
