'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { TelemetryPacket, TacticalPacket, RadarContact, RadarTarget } from '@jarvis-dcs/shared'
import { hasTargetFlag, TargetFlags } from '@jarvis-dcs/shared'
import { metresToNM, metresToFeet, mpsToKnots } from '@/lib/conversions'

interface RadarScopeProps {
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
}

const RANGE_OPTIONS = [10, 20, 40, 80] as const
type RangeNM = typeof RANGE_OPTIONS[number]

// Colors from JARVIS theme
const COLOR = {
  bg: '#010a1a',
  ring: 'rgba(0, 212, 255, 0.15)',
  ringLabel: 'rgba(0, 212, 255, 0.4)',
  heading: 'rgba(0, 212, 255, 0.6)',
  north: '#00ff88',
  ownship: '#00ffff',
  contact: 'rgba(0, 212, 255, 0.7)',
  locked: '#ff4444',
  tracked: '#ffaa00',
  friendly: '#00ff88',
  hostile: '#ff4444',
  unknown: 'rgba(0, 212, 255, 0.5)',
  label: 'rgba(0, 212, 255, 0.7)',
  scanline: 'rgba(0, 255, 255, 0.03)',
}

export function RadarScope({ telemetry, tactical }: RadarScopeProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [rangeNM, setRangeNM] = useState<RangeNM>(40)
  const [canvasSize, setCanvasSize] = useState(400)

  // Data refs to avoid re-render on each frame
  const telemetryRef = useRef(telemetry)
  const tacticalRef = useRef(tactical)
  const rangeRef = useRef(rangeNM)

  useEffect(() => { telemetryRef.current = telemetry }, [telemetry])
  useEffect(() => { tacticalRef.current = tactical }, [tactical])
  useEffect(() => { rangeRef.current = rangeNM }, [rangeNM])

  // Resize observer for responsive canvas
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    const observer = new ResizeObserver((entries) => {
      for (const entry of entries) {
        const { width, height } = entry.contentRect
        const size = Math.min(width, height)
        setCanvasSize(Math.max(200, Math.floor(size)))
      }
    })

    observer.observe(container)
    return () => observer.disconnect()
  }, [])

  // Main render loop using requestAnimationFrame
  const renderFrame = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const tel = telemetryRef.current
    const tac = tacticalRef.current
    const range = rangeRef.current

    const size = canvas.width
    const cx = size / 2
    const cy = size / 2
    const radius = (size / 2) - 30 // padding for labels

    // Ownship heading (radians, 0=north, clockwise)
    const hdg = tel?.hdg_rad ?? 0

    // Clear
    ctx.clearRect(0, 0, size, size)

    // Background
    ctx.fillStyle = COLOR.bg
    ctx.beginPath()
    ctx.arc(cx, cy, radius + 20, 0, Math.PI * 2)
    ctx.fill()

    // Scope border
    ctx.beginPath()
    ctx.arc(cx, cy, radius, 0, Math.PI * 2)
    ctx.strokeStyle = 'rgba(0, 212, 255, 0.3)'
    ctx.lineWidth = 1.5
    ctx.stroke()

    // Range rings
    const ringSteps = 4
    for (let i = 1; i <= ringSteps; i++) {
      const r = (radius / ringSteps) * i
      ctx.beginPath()
      ctx.arc(cx, cy, r, 0, Math.PI * 2)
      ctx.strokeStyle = COLOR.ring
      ctx.lineWidth = 0.5
      ctx.stroke()

      // Range label
      const ringNM = Math.round((range / ringSteps) * i)
      ctx.font = '9px "Courier New"'
      ctx.fillStyle = COLOR.ringLabel
      ctx.textAlign = 'center'
      ctx.fillText(`${ringNM}`, cx, cy - r + 10)
    }

    // Heading-up: cross lines (rotated by heading)
    ctx.save()
    ctx.translate(cx, cy)

    // Cardinal direction lines
    for (let i = 0; i < 12; i++) {
      const angle = (i * 30 * Math.PI) / 180 - hdg
      const innerR = radius - 8
      const outerR = radius

      ctx.beginPath()
      ctx.moveTo(Math.sin(angle) * innerR, -Math.cos(angle) * innerR)
      ctx.lineTo(Math.sin(angle) * outerR, -Math.cos(angle) * outerR)
      ctx.strokeStyle = i % 3 === 0 ? COLOR.heading : 'rgba(0, 212, 255, 0.2)'
      ctx.lineWidth = i % 3 === 0 ? 1.5 : 0.5
      ctx.stroke()
    }

    // North indicator (heading-up, so north rotates)
    const northAngle = -hdg
    const northX = Math.sin(northAngle) * (radius + 12)
    const northY = -Math.cos(northAngle) * (radius + 12)
    ctx.font = 'bold 11px "Courier New"'
    ctx.fillStyle = COLOR.north
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('N', northX, northY)

    ctx.restore()

    // Ownship marker at center
    ctx.save()
    ctx.translate(cx, cy)
    ctx.beginPath()
    ctx.moveTo(0, -8)
    ctx.lineTo(-5, 6)
    ctx.lineTo(0, 3)
    ctx.lineTo(5, 6)
    ctx.closePath()
    ctx.fillStyle = COLOR.ownship
    ctx.fill()
    ctx.restore()

    // Heading-up center line (points up = forward)
    ctx.beginPath()
    ctx.moveTo(cx, cy - 10)
    ctx.lineTo(cx, cy - radius + 2)
    ctx.strokeStyle = 'rgba(0, 255, 255, 0.15)'
    ctx.lineWidth = 0.5
    ctx.setLineDash([4, 4])
    ctx.stroke()
    ctx.setLineDash([])

    // Ownship lat/lon for range/bearing calculations
    const ownLat = tel?.pos?.lat ?? 0
    const ownLon = tel?.pos?.lon ?? 0
    const rangeMetres = range * 1852 // NM to metres

    // Render world objects as contacts
    if (tac?.objects) {
      const lockedIds = new Set((tac.locked ?? []).map((l) => l.id))
      const trackedIds = new Set((tac.targets ?? []).map((t) => t.id))

      for (const obj of tac.objects) {
        const { dx, dy } = latLonToRelative(ownLat, ownLon, obj.lat, obj.lon, hdg)
        const distMetres = Math.sqrt(dx * dx + dy * dy)

        // Skip if out of range
        if (distMetres > rangeMetres * 1.1) continue

        // Convert to canvas coords
        const px = cx + (dx / rangeMetres) * radius
        const py = cy - (dy / rangeMetres) * radius

        const isLocked = lockedIds.has(obj.id)
        const isTracked = trackedIds.has(obj.id)

        // Contact marker
        drawContact(ctx, px, py, obj, isLocked, isTracked)
      }
    }

    // Render radar targets that might not be in objects (sensor-only tracks)
    if (tac?.targets) {
      for (const tgt of tac.targets) {
        // Use fim/fin (body-axis angles) for relative position
        const distNM = metresToNM(tgt.dist)
        if (distNM > range * 1.1) continue

        const isLocked = hasTargetFlag(tgt.flags, TargetFlags.RADAR_LOCK) ||
                         hasTargetFlag(tgt.flags, TargetFlags.EOS_LOCK)

        // Convert body-axis angles to screen position (heading-up)
        const pixDist = (tgt.dist / rangeMetres) * radius
        const px = cx + Math.sin(tgt.fim) * pixDist
        const py = cy - Math.cos(tgt.fin) * pixDist

        // Draw radar target blip
        drawRadarBlip(ctx, px, py, tgt, isLocked)
      }
    }

    // Scan sweep effect (cosmetic)
    const sweepAngle = (Date.now() / 2000 * Math.PI * 2) % (Math.PI * 2)
    ctx.save()
    ctx.translate(cx, cy)
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.arc(0, 0, radius, sweepAngle - 0.15, sweepAngle)
    ctx.closePath()
    const sweepGrad = ctx.createRadialGradient(0, 0, 0, 0, 0, radius)
    sweepGrad.addColorStop(0, 'rgba(0, 255, 255, 0.05)')
    sweepGrad.addColorStop(1, 'rgba(0, 255, 255, 0.02)')
    ctx.fillStyle = sweepGrad
    ctx.fill()
    ctx.restore()
  }, [])

  // Animation loop
  useEffect(() => {
    let frameId: number

    const loop = () => {
      renderFrame()
      frameId = requestAnimationFrame(loop)
    }
    frameId = requestAnimationFrame(loop)

    return () => cancelAnimationFrame(frameId)
  }, [renderFrame])

  const cycleRange = () => {
    setRangeNM((prev) => {
      const idx = RANGE_OPTIONS.indexOf(prev)
      return RANGE_OPTIONS[(idx + 1) % RANGE_OPTIONS.length]
    })
  }

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center">
      {/* Range selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[10px] opacity-45" style={{ letterSpacing: '1px' }}>RANGE</span>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRangeNM(r)}
            className={`px-2 py-0.5 text-[11px] font-bold border cursor-pointer transition-all ${
              r === rangeNM
                ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10'
                : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="text-[10px] opacity-45">NM</span>
      </div>

      {/* Radar canvas */}
      <canvas
        ref={canvasRef}
        width={canvasSize}
        height={canvasSize}
        onClick={cycleRange}
        className="cursor-crosshair"
        style={{ maxWidth: '100%', maxHeight: 'calc(100% - 40px)' }}
      />
    </div>
  )
}

/** Convert lat/lon delta to relative X/Y in metres (heading-up) */
function latLonToRelative(
  ownLat: number, ownLon: number,
  tgtLat: number, tgtLon: number,
  hdgRad: number,
): { dx: number; dy: number } {
  // Approximate metres per degree at this latitude
  const latRad = ownLat * Math.PI / 180
  const mPerDegLat = 111320
  const mPerDegLon = 111320 * Math.cos(latRad)

  // North-up delta
  const dNorth = (tgtLat - ownLat) * mPerDegLat
  const dEast = (tgtLon - ownLon) * mPerDegLon

  // Rotate to heading-up (heading-up means north is at hdg angle from top)
  const sinH = Math.sin(hdgRad)
  const cosH = Math.cos(hdgRad)
  const dx = dEast * cosH - dNorth * sinH
  const dy = dNorth * cosH + dEast * sinH

  return { dx, dy }
}

/** Draw a world object contact marker */
function drawContact(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  obj: RadarContact,
  isLocked: boolean,
  isTracked: boolean,
) {
  const color = isLocked ? COLOR.locked
    : isTracked ? COLOR.tracked
    : obj.coal === 'Enemies' ? COLOR.hostile
    : obj.coal === 'Allies' ? COLOR.friendly
    : COLOR.unknown

  // Contact diamond
  ctx.save()
  ctx.translate(x, y)

  ctx.beginPath()
  ctx.moveTo(0, -5)
  ctx.lineTo(4, 0)
  ctx.lineTo(0, 5)
  ctx.lineTo(-4, 0)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()

  // Lock ring
  if (isLocked) {
    ctx.beginPath()
    ctx.arc(0, 0, 8, 0, Math.PI * 2)
    ctx.strokeStyle = COLOR.locked
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Velocity vector arrow
  if (obj.hdg) {
    const vLen = 12
    const vx = Math.sin(obj.hdg) * vLen
    const vy = -Math.cos(obj.hdg) * vLen
    ctx.beginPath()
    ctx.moveTo(0, 0)
    ctx.lineTo(vx, vy)
    ctx.strokeStyle = color
    ctx.lineWidth = 1
    ctx.stroke()
  }

  // Labels
  ctx.font = '8px "Courier New"'
  ctx.fillStyle = COLOR.label
  ctx.textAlign = 'left'
  const altFt = Math.round(metresToFeet(obj.alt) / 100) // FL
  ctx.fillText(`${altFt}`, 8, -2)

  ctx.restore()
}

/** Draw a radar-tracked target blip */
function drawRadarBlip(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  tgt: RadarTarget,
  isLocked: boolean,
) {
  const color = isLocked ? COLOR.locked : COLOR.tracked

  ctx.save()
  ctx.translate(x, y)

  // Target arc (radar return)
  ctx.beginPath()
  ctx.arc(0, 0, 3, 0, Math.PI * 2)
  ctx.fillStyle = color
  ctx.fill()

  if (isLocked) {
    ctx.beginPath()
    ctx.arc(0, 0, 7, 0, Math.PI * 2)
    ctx.strokeStyle = COLOR.locked
    ctx.lineWidth = 1.5
    ctx.stroke()
  }

  // Speed label
  const spdKts = Math.round(mpsToKnots(tgt.mach * 340))
  ctx.font = '8px "Courier New"'
  ctx.fillStyle = COLOR.label
  ctx.textAlign = 'left'
  ctx.fillText(`${spdKts}`, 6, 3)

  ctx.restore()
}
