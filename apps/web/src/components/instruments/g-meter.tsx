'use client'

import { useRef, useEffect } from 'react'

interface GMeterProps {
  gY: number  // Vertical G-load
  isOffline?: boolean
}

export function GMeter({ gY, isOffline = false }: GMeterProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height } = canvas
    const centerX = width / 2
    const centerY = height / 2

    // Clear
    ctx.clearRect(0, 0, width, height)

    // Dark background
    ctx.fillStyle = '#000d1a'
    ctx.fillRect(0, 0, width, height)

    const minG = -3
    const maxG = 9
    const range = maxG - minG
    const pixelsPerG = (height - 40) / range

    // Draw caution zones
    // Red zone above 7G
    ctx.fillStyle = 'rgba(255, 68, 68, 0.15)'
    const redlineY = centerY - (7 - minG) * pixelsPerG
    ctx.fillRect(10, 10, width - 20, redlineY - 10)

    // Amber zone 5-7G
    ctx.fillStyle = 'rgba(255, 170, 0, 0.15)'
    const amberTopY = centerY - (5 - minG) * pixelsPerG
    ctx.fillRect(10, amberTopY, width - 20, redlineY - amberTopY)

    // Red zone below -1G
    ctx.fillStyle = 'rgba(255, 68, 68, 0.15)'
    const negGLimitY = centerY + (0 - (-1)) * pixelsPerG
    ctx.fillRect(10, negGLimitY, width - 20, height - 10 - negGLimitY)

    // G scale markings
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)'
    ctx.font = '12px "Courier New"'
    ctx.textAlign = 'right'
    ctx.textBaseline = 'middle'
    ctx.lineWidth = 1

    for (let g = minG; g <= maxG; g++) {
      const y = centerY + (minG - g) * pixelsPerG
      const isInteger = Number.isInteger(g)
      const isHalfInteger = !isInteger && Number.isInteger(g * 2)

      if (isInteger) {
        // Major tick
        ctx.beginPath()
        ctx.moveTo(centerX - 15, y)
        ctx.lineTo(centerX + 15, y)
        ctx.strokeStyle = g === 1 ? '#00ff88' : 'rgba(0, 212, 255, 0.5)'
        ctx.stroke()

        // Label
        ctx.fillText(`${g}G`, centerX - 28, y)
      } else if (isHalfInteger) {
        // Minor tick
        ctx.beginPath()
        ctx.moveTo(centerX - 8, y)
        ctx.lineTo(centerX + 8, y)
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
        ctx.stroke()
      }
    }

    if (!isOffline) {
      // Clamp G for display
      const clampedG = Math.max(minG, Math.min(maxG, gY))
      const needleY = centerY + (minG - clampedG) * pixelsPerG

      // Needle/bar indicator
      const barColor = gY > 7 ? '#ff4444' : gY > 5 ? '#ffaa00' : gY < -1 ? '#ff4444' : '#00ffff'
      ctx.fillStyle = barColor

      // Draw needle as filled triangle
      ctx.beginPath()
      ctx.moveTo(centerX, needleY - 8)
      ctx.lineTo(centerX + 12, needleY)
      ctx.lineTo(centerX, needleY + 8)
      ctx.lineTo(centerX - 12, needleY)
      ctx.closePath()
      ctx.fill()

      // Glow effect for needle
      ctx.shadowColor = barColor
      ctx.shadowBlur = 10
      ctx.fill()
      ctx.shadowBlur = 0

      // Center display of current G (clamped to realistic range)
      const displayG = Math.max(-4, Math.min(10, gY))
      ctx.fillStyle = barColor
      ctx.font = 'bold 56px "Courier New"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText(displayG.toFixed(1), centerX, centerY)

      ctx.font = '14px "Courier New"'
      ctx.fillStyle = 'rgba(0, 212, 255, 0.5)'
      ctx.fillText('G-LOAD', centerX, centerY + 38)
    } else {
      // Offline: draw NO DATA text at center
      ctx.fillStyle = 'rgba(0, 212, 255, 0.15)'
      ctx.font = '11px "Courier New"'
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('NO DATA', centerX, centerY)
    }

    // Border
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1
    ctx.strokeRect(5, 5, width - 10, height - 10)
  }, [gY, isOffline])

  return (
    <>
      <div className="hidden md:flex justify-center mt-2">
        <canvas
          ref={canvasRef}
          width={120}
          height={220}
          style={{ imageRendering: 'pixelated' }}
        />
      </div>
      <div className="md:hidden jarvis-panel py-2 px-3">
        <div className="text-[11px] opacity-50 font-bold mb-1" style={{ letterSpacing: '2px' }}>G-FORCE</div>
        <div className="text-center">
          {isOffline ? (
            <>
              <span className="text-[28px] font-bold tabular-nums text-jarvis-muted opacity-40">---</span>
              <span className="text-[13px] opacity-40 ml-1">G</span>
            </>
          ) : (
            <>
              <span className={`text-[28px] font-bold tabular-nums ${
                gY > 7 || gY < -2 ? 'text-jarvis-danger' : gY > 5 ? 'text-jarvis-warning' : 'text-jarvis-accent'
              }`}>
                {gY.toFixed(1)}
              </span>
              <span className="text-[13px] opacity-40 ml-1">G</span>
            </>
          )}
        </div>
      </div>
    </>
  )
}
