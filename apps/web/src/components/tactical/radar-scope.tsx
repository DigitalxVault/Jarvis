'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import type { TelemetryPacket, TacticalPacket, RadarContact, RadarTarget, Waypoint } from '@jarvis-dcs/shared'
import { hasTargetFlag, TargetFlags } from '@jarvis-dcs/shared'
import { metresToNM, metresToFeet, mpsToKnots, bearingDeg, distanceNM, formatHeading } from '@/lib/conversions'

interface RadarScopeProps {
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
}

interface DestroyedContact {
  id: number
  lat: number
  lon: number
  alt: number
  destroyedAt: number
}

const KILL_FADE_MS = 5000
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
  waypoint: '#00ff88',
  waypointActive: '#00ffff',
  waypointRoute: 'rgba(0, 255, 136, 0.25)',
  bearingLine: 'rgba(0, 255, 255, 0.3)',
  statusText: 'rgba(0, 212, 255, 0.5)',
  diagText: 'rgba(0, 212, 255, 0.35)',
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
  const lastTacticalAtRef = useRef(0)
  const prevEnemyMapRef = useRef<Map<number, RadarContact>>(new Map())
  const destroyedRef = useRef<DestroyedContact[]>([])

  useEffect(() => { telemetryRef.current = telemetry }, [telemetry])
  useEffect(() => {
    tacticalRef.current = tactical
    if (tactical) lastTacticalAtRef.current = Date.now()
  }, [tactical])
  useEffect(() => { rangeRef.current = rangeNM }, [rangeNM])

  // Destroyed enemy detection
  useEffect(() => {
    if (!tactical) return

    const now = Date.now()
    const tacticalAge = now - lastTacticalAtRef.current

    // Staleness guard: if tactical data had a >5s gap, clear prev map to avoid false kills
    if (tacticalAge > 5000 && lastTacticalAtRef.current > 0) {
      prevEnemyMapRef.current = new Map()
    }

    // Build current enemy map
    const currentEnemies = new Map<number, RadarContact>()
    if (tactical.objects) {
      for (const obj of tactical.objects) {
        if (obj.coal === 'Enemies') {
          currentEnemies.set(obj.id, obj)
        }
      }
    }

    const prevMap = prevEnemyMapRef.current

    // Only check for kills if we had a previous frame
    if (prevMap.size > 0) {
      const missingIds: number[] = []
      for (const [id] of prevMap) {
        if (!currentEnemies.has(id)) {
          missingIds.push(id)
        }
      }

      // Mission reset guard: if >50% vanish simultaneously, treat as reset
      if (missingIds.length > 0 && missingIds.length <= prevMap.size * 0.5) {
        for (const id of missingIds) {
          const prev = prevMap.get(id)!
          destroyedRef.current.push({
            id,
            lat: prev.lat,
            lon: prev.lon,
            alt: prev.alt,
            destroyedAt: now,
          })
        }
      }
    }

    // Clean up expired entries
    destroyedRef.current = destroyedRef.current.filter(
      (d) => now - d.destroyedAt < KILL_FADE_MS,
    )

    // Store current frame for next comparison
    prevEnemyMapRef.current = currentEnemies
  }, [tactical])

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
      ctx.font = '12px "Courier New"'
      ctx.fillStyle = COLOR.ringLabel
      ctx.textAlign = 'center'
      ctx.fillText(`${ringNM}`, cx, cy - r + 12)
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
    ctx.font = 'bold 14px "Courier New"'
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

    // Staleness: dim contacts if tactical data is >5s old
    const tacticalAge = Date.now() - lastTacticalAtRef.current
    const isStale = lastTacticalAtRef.current > 0 && tacticalAge > 5000
    const contactAlpha = isStale ? 0.5 : 1.0

    // Render destroyed markers (red X at last known position)
    const now = Date.now()
    for (const d of destroyedRef.current) {
      const elapsed = now - d.destroyedAt
      if (elapsed > KILL_FADE_MS) continue

      const { dx, dy } = latLonToRelative(ownLat, ownLon, d.lat, d.lon, hdg)
      const distMetres = Math.sqrt(dx * dx + dy * dy)
      if (distMetres > rangeMetres * 1.1) continue

      const px = cx + (dx / rangeMetres) * radius
      const py = cy - (dy / rangeMetres) * radius
      const fadeAlpha = 1.0 - elapsed / KILL_FADE_MS

      drawDestroyedMarker(ctx, px, py, fadeAlpha)
    }

    // Render world objects as contacts
    if (tac?.objects) {
      ctx.globalAlpha = contactAlpha
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
        drawContact(ctx, px, py, obj, isLocked, isTracked, hdg)
      }
      ctx.globalAlpha = 1.0
    }

    // Render radar targets that might not be in objects (sensor-only tracks)
    if (tac?.targets) {
      ctx.globalAlpha = contactAlpha
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
      ctx.globalAlpha = 1.0
    }

    // ── Waypoint rendering ──
    const route = tac?.route
    const currentWp = tac?.nav?.current_wp ?? 0
    if (route && route.length > 0 && ownLat !== 0) {
      // Route line (dashed green connecting waypoints in order)
      ctx.save()
      ctx.setLineDash([4, 6])
      ctx.strokeStyle = COLOR.waypointRoute
      ctx.lineWidth = 1
      ctx.beginPath()
      let firstInScope = true
      for (const wp of route) {
        const { dx, dy } = latLonToRelative(ownLat, ownLon, wp.lat, wp.lon, hdg)
        const px = cx + (dx / rangeMetres) * radius
        const py = cy - (dy / rangeMetres) * radius
        if (firstInScope) { ctx.moveTo(px, py); firstInScope = false }
        else ctx.lineTo(px, py)
      }
      ctx.stroke()
      ctx.setLineDash([])
      ctx.restore()

      // Bearing line from ownship to active waypoint
      const activeWp = route.find((w) => w.idx === currentWp)
      if (activeWp) {
        const { dx: awDx, dy: awDy } = latLonToRelative(ownLat, ownLon, activeWp.lat, activeWp.lon, hdg)
        const awPx = cx + (awDx / rangeMetres) * radius
        const awPy = cy - (awDy / rangeMetres) * radius

        ctx.save()
        ctx.setLineDash([6, 4])
        ctx.strokeStyle = COLOR.bearingLine
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(cx, cy)
        ctx.lineTo(awPx, awPy)
        ctx.stroke()
        ctx.setLineDash([])
        ctx.restore()

        // Bearing/distance readout at top of scope
        const brg = bearingDeg(ownLat, ownLon, activeWp.lat, activeWp.lon)
        const dist = distanceNM(ownLat, ownLon, activeWp.lat, activeWp.lon)
        ctx.font = 'bold 12px "Courier New"'
        ctx.fillStyle = COLOR.waypointActive
        ctx.textAlign = 'center'
        ctx.fillText(
          `STPT ${currentWp} → ${formatHeading(brg)}° / ${dist.toFixed(1)} NM`,
          cx, cy - radius + 26,
        )
      }

      // Individual waypoint markers
      for (const wp of route) {
        const { dx, dy } = latLonToRelative(ownLat, ownLon, wp.lat, wp.lon, hdg)
        const px = cx + (dx / rangeMetres) * radius
        const py = cy - (dy / rangeMetres) * radius

        // Skip if far outside scope (allow some bleed)
        const screenDist = Math.sqrt((px - cx) ** 2 + (py - cy) ** 2)
        if (screenDist > radius * 1.3) continue

        const isActive = wp.idx === currentWp
        const color = isActive ? COLOR.waypointActive : COLOR.waypoint

        ctx.save()
        ctx.translate(px, py)

        // Square marker
        const sz = isActive ? 5 : 4
        ctx.strokeStyle = color
        ctx.lineWidth = isActive ? 2 : 1
        ctx.strokeRect(-sz, -sz, sz * 2, sz * 2)

        // Active highlight ring
        if (isActive) {
          ctx.beginPath()
          ctx.arc(0, 0, 10, 0, Math.PI * 2)
          ctx.strokeStyle = COLOR.waypointActive
          ctx.lineWidth = 1.5
          ctx.stroke()
        }

        // Index label
        ctx.font = `${isActive ? 'bold ' : ''}12px "Courier New"`
        ctx.fillStyle = color
        ctx.textAlign = 'left'
        ctx.fillText(`${wp.idx}`, sz + 4, 3)

        ctx.restore()
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

    // ── Status feedback overlay ──
    if (!tac) {
      // No tactical data at all
      ctx.font = '12px "Courier New"'
      ctx.fillStyle = COLOR.statusText
      ctx.textAlign = 'center'
      ctx.textBaseline = 'middle'
      ctx.fillText('AWAITING TACTICAL', cx, cy + radius * 0.35)
    } else {
      const objCount = tac.objects?.length ?? 0
      const tgtCount = tac.targets?.length ?? 0
      if (objCount === 0 && tgtCount === 0 && (!route || route.length === 0)) {
        ctx.font = '12px "Courier New"'
        ctx.fillStyle = COLOR.statusText
        ctx.textAlign = 'center'
        ctx.textBaseline = 'middle'
        ctx.fillText('NO CONTACTS', cx, cy + radius * 0.35)
      }
    }

    // ── Diagnostic readout at bottom of scope ──
    if (tac) {
      const objCount = tac.objects?.length ?? 0
      const tgtCount = tac.targets?.length ?? 0
      const lckCount = tac.locked?.length ?? 0
      const permObj = tac.permissions?.objects !== false
      const permSns = tac.permissions?.sensors !== false

      ctx.font = '12px "Courier New"'
      ctx.fillStyle = COLOR.diagText
      ctx.textAlign = 'center'
      const diagY = cy + radius + 14

      const kiaCount = destroyedRef.current.length
      const staleTag = isStale ? ' STALE' : ''
      ctx.fillText(
        `OBJ:${objCount} TGT:${tgtCount} LCK:${lckCount} KIA:${kiaCount}  PERM: OBJ${permObj ? '✓' : '✗'} SNS${permSns ? '✓' : '✗'}${staleTag}`,
        cx, diagY,
      )
    }
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

  const isGated = tactical && (
    !(tactical.permissions?.objects) || !(tactical.permissions?.sensors)
  )

  return (
    <div ref={containerRef} className="w-full h-full flex flex-col items-center justify-center">
      {/* Range selector */}
      <div className="flex items-center gap-2 mb-2">
        <span className="text-[12px] opacity-45" style={{ letterSpacing: '1px' }}>RANGE</span>
        {RANGE_OPTIONS.map((r) => (
          <button
            key={r}
            onClick={() => setRangeNM(r)}
            className={`px-2 py-0.5 text-[13px] font-bold border cursor-pointer transition-all ${
              r === rangeNM
                ? 'border-jarvis-accent text-jarvis-accent bg-jarvis-accent/10'
                : 'border-jarvis-border text-jarvis-muted hover:border-jarvis-primary'
            }`}
          >
            {r}
          </button>
        ))}
        <span className="text-[12px] opacity-45">NM</span>
      </div>

      {/* Radar canvas with gating overlay */}
      <div className="relative">
        <canvas
          ref={canvasRef}
          width={canvasSize}
          height={canvasSize}
          onClick={cycleRange}
          className="cursor-crosshair"
          style={{ maxWidth: '100%', maxHeight: 'calc(100% - 40px)' }}
        />

        {/* Anti-cheat gating notice */}
        {isGated && (
          <div className="absolute inset-0 flex items-end justify-center pb-16 pointer-events-none">
            <div className="text-center bg-jarvis-bar/80 px-4 py-2 border border-jarvis-warning/30 rounded">
              <div className="text-[13px] text-jarvis-warning" style={{ letterSpacing: '1px' }}>
                EXPORT RESTRICTED
              </div>
              <div className="text-[12px] text-jarvis-muted mt-1" style={{ letterSpacing: '0.5px' }}>
                DCS server denies object/sensor export
              </div>
              <div className="text-[12px] text-jarvis-muted" style={{ letterSpacing: '0.5px' }}>
                Contacts unavailable (anti-cheat)
              </div>
            </div>
          </div>
        )}
      </div>
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

/** Draw a world object contact marker (filled triangle, rotated to heading) */
function drawContact(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  obj: RadarContact,
  isLocked: boolean,
  isTracked: boolean,
  ownHdg: number,
) {
  // Coalition-based color
  const color = isLocked ? COLOR.locked
    : isTracked ? COLOR.tracked
    : obj.coal === 'Enemies' ? COLOR.hostile
    : obj.coal === 'Allies' ? COLOR.friendly
    : COLOR.unknown

  // Coalition-based triangle sizing
  let triH: number, triW: number
  if (obj.coal === 'Enemies') {
    triH = 9; triW = 8  // 18px tall, 16px wide
  } else if (obj.coal === 'Allies') {
    triH = 7; triW = 6  // 14px tall, 12px wide
  } else {
    triH = 6; triW = 5  // 12px tall, 10px wide
  }

  ctx.save()
  ctx.translate(x, y)

  // Rotate triangle to point in direction of travel (heading-up corrected)
  if (obj.hdg != null) {
    ctx.rotate(obj.hdg - ownHdg)
  }

  // Filled triangle (pointing up = forward)
  ctx.beginPath()
  ctx.moveTo(0, -triH)
  ctx.lineTo(-triW, triH)
  ctx.lineTo(triW, triH)
  ctx.closePath()
  ctx.fillStyle = color
  ctx.fill()
  ctx.strokeStyle = color
  ctx.lineWidth = 1.5
  ctx.stroke()

  // Reset rotation for lock ring and labels
  ctx.setTransform(1, 0, 0, 1, 0, 0)
  ctx.translate(x, y)

  // Lock ring
  if (isLocked) {
    ctx.beginPath()
    ctx.arc(0, 0, triH + 5, 0, Math.PI * 2)
    ctx.strokeStyle = COLOR.locked
    ctx.lineWidth = 2
    ctx.stroke()
  }

  // Altitude label
  ctx.font = '12px "Courier New"'
  ctx.fillStyle = COLOR.label
  ctx.textAlign = 'left'
  const altFt = Math.round(metresToFeet(obj.alt) / 100) // FL
  ctx.fillText(`${altFt}`, triW + 4, -2)

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
  ctx.font = '12px "Courier New"'
  ctx.fillStyle = COLOR.label
  ctx.textAlign = 'left'
  ctx.fillText(`${spdKts}`, 8, 4)

  ctx.restore()
}

/** Draw a destroyed contact marker (red X with fade) */
function drawDestroyedMarker(
  ctx: CanvasRenderingContext2D,
  x: number, y: number,
  alpha: number,
) {
  const arm = 8

  ctx.save()
  ctx.translate(x, y)
  ctx.globalAlpha = alpha

  // Red X
  ctx.strokeStyle = COLOR.hostile
  ctx.lineWidth = 2.5
  ctx.lineCap = 'round'

  ctx.beginPath()
  ctx.moveTo(-arm, -arm)
  ctx.lineTo(arm, arm)
  ctx.stroke()

  ctx.beginPath()
  ctx.moveTo(arm, -arm)
  ctx.lineTo(-arm, arm)
  ctx.stroke()

  // Center dot
  ctx.beginPath()
  ctx.arc(0, 0, 2, 0, Math.PI * 2)
  ctx.fillStyle = COLOR.hostile
  ctx.fill()

  ctx.restore()
}
