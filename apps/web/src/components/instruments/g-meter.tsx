'use client'

import { useRef, useEffect } from 'react'

interface GMeterProps {
  gY: number  // Vertical G-load
  className?: string
}

export function GMeter({ gY, className = '' }: GMeterProps) {
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
    ctx.font = '10px "Courier New"'
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
        ctx.fillText(`${g}G`, centerX - 20, y)
      } else if (isHalfInteger) {
        // Minor tick
        ctx.beginPath()
        ctx.moveTo(centerX - 8, y)
        ctx.lineTo(centerX + 8, y)
        ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
        ctx.stroke()
      }
    }

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

    // Center display of current G
    ctx.fillStyle = barColor
    ctx.font = 'bold 24px "Courier New"'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(gY.toFixed(1), centerX, centerY)

    ctx.font = '10px "Courier New"'
    ctx.fillStyle = 'rgba(0, 212, 255, 0.5)'
    ctx.fillText('G-LOAD', centerX, centerY + 18)

    // Border
    ctx.strokeStyle = '#00d4ff'
    ctx.lineWidth = 1
    ctx.strokeRect(5, 5, width - 10, height - 10)
  }, [gY])

  return (
    <div className={className}>
      <div className="jarvis-panel">
        <div className="panel-title">▸ G-METER</div>
        <div className="flex justify-center mt-2">
          <canvas
            ref={canvasRef}
            width={80}
            height={180}
            style={{ imageRendering: 'pixelated' }}
          />
        </div>
      </div>
    </div>
  )
}
