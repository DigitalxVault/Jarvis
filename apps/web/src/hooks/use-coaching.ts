'use client'

import { useEffect, useRef, useState } from 'react'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { mpsToKnots, metresToFeet, radToDeg } from '@/lib/conversions'

export interface CoachingBand {
  /** Target value (e.g., 350 knots, 25000 ft) */
  target: number
  /** Allowable deviation (+/-) */
  tolerance: number
  /** Current value */
  current: number | null
  /** Deviation from target (positive = above, negative = below) */
  deviation: number | null
  /** Status: in-band, high, low, or no-data */
  status: 'in-band' | 'high' | 'low' | 'no-data'
}

export interface SmoothnessScore {
  /** Overall smoothness 0-100 */
  score: number
  /** Current angular velocity magnitude */
  currentAngVel: number
  /** Average over window */
  averageAngVel: number
}

interface CoachingState {
  speedBand: CoachingBand
  altBand: CoachingBand
  headingTrack: CoachingBand
  smoothness: SmoothnessScore
}

interface UseCoachingOptions {
  /** Target speed in knots */
  targetSpeedKnots?: number
  /** Speed tolerance in knots */
  speedTolerance?: number
  /** Target altitude in feet */
  targetAltFt?: number
  /** Altitude tolerance in feet */
  altTolerance?: number
  /** Target heading in degrees */
  targetHeadingDeg?: number
  /** Heading tolerance in degrees */
  headingTolerance?: number
}

const DEFAULT_OPTIONS: Required<UseCoachingOptions> = {
  targetSpeedKnots: 350,
  speedTolerance: 50,
  targetAltFt: 25000,
  altTolerance: 200,
  targetHeadingDeg: 270,
  headingTolerance: 10,
}

export function useCoaching(
  telemetry: TelemetryPacket | null,
  options: UseCoachingOptions = {}
): CoachingState {
  const opts = { ...DEFAULT_OPTIONS, ...options }

  // Circular buffer for angular velocity (last 50 samples)
  const angVelBuffer = useRef<number[]>([])
  const maxSamples = 50

  const [speedBand, setSpeedBand] = useState<CoachingBand>({
    target: opts.targetSpeedKnots,
    tolerance: opts.speedTolerance,
    current: null,
    deviation: null,
    status: 'no-data',
  })

  const [altBand, setAltBand] = useState<CoachingBand>({
    target: opts.targetAltFt,
    tolerance: opts.altTolerance,
    current: null,
    deviation: null,
    status: 'no-data',
  })

  const [headingTrack, setHeadingTrack] = useState<CoachingBand>({
    target: opts.targetHeadingDeg,
    tolerance: opts.headingTolerance,
    current: null,
    deviation: null,
    status: 'no-data',
  })

  const [smoothness, setSmoothness] = useState<SmoothnessScore>({
    score: 100,
    currentAngVel: 0,
    averageAngVel: 0,
  })

  useEffect(() => {
    if (!telemetry) {
      setSpeedBand((prev) => ({ ...prev, current: null, deviation: null, status: 'no-data' }))
      setAltBand((prev) => ({ ...prev, current: null, deviation: null, status: 'no-data' }))
      setHeadingTrack((prev) => ({ ...prev, current: null, deviation: null, status: 'no-data' }))
      return
    }

    // Speed band
    const currentKnots = mpsToKnots(telemetry.spd.ias_mps)
    const speedDev = currentKnots - opts.targetSpeedKnots
    setSpeedBand({
      target: opts.targetSpeedKnots,
      tolerance: opts.speedTolerance,
      current: currentKnots,
      deviation: speedDev,
      status: Math.abs(speedDev) <= opts.speedTolerance
        ? 'in-band'
        : speedDev > 0
          ? 'high'
          : 'low',
    })

    // Altitude band
    const currentAlt = metresToFeet(telemetry.pos.alt_m)
    const altDev = currentAlt - opts.targetAltFt
    setAltBand({
      target: opts.targetAltFt,
      tolerance: opts.altTolerance,
      current: currentAlt,
      deviation: altDev,
      status: Math.abs(altDev) <= opts.altTolerance
        ? 'in-band'
        : altDev > 0
          ? 'high'
          : 'low',
    })

    // Heading track
    const currentHdg = radToDeg(telemetry.hdg_rad)
    // Handle wraparound for heading deviation
    let hdgDev = currentHdg - opts.targetHeadingDeg
    if (hdgDev > 180) hdgDev -= 360
    if (hdgDev < -180) hdgDev += 360

    setHeadingTrack({
      target: opts.targetHeadingDeg,
      tolerance: opts.headingTolerance,
      current: currentHdg,
      deviation: hdgDev,
      status: Math.abs(hdgDev) <= opts.headingTolerance
        ? 'in-band'
        : hdgDev > 0
          ? 'high'
          : 'low',
    })

    // Smoothness calculation
    const angVel = telemetry.aero?.ang_vel
    if (angVel) {
      // Magnitude of angular velocity vector
      const angVelMag = Math.sqrt(angVel.x ** 2 + angVel.y ** 2 + angVel.z ** 2)
      angVelBuffer.current.push(angVelMag)
      if (angVelBuffer.current.length > maxSamples) {
        angVelBuffer.current.shift()
      }

      const avgAngVel =
        angVelBuffer.current.reduce((a, b) => a + b, 0) / angVelBuffer.current.length

      // Score: lower average angular velocity = smoother = higher score
      // 0 rad/s = 100 score, 0.5 rad/s = 0 score (non-linear)
      const rawScore = Math.max(0, 100 - (avgAngVel * 200))
      const score = Math.round(rawScore)

      setSmoothness({
        score,
        currentAngVel: angVelMag,
        averageAngVel: avgAngVel,
      })
    }
  }, [telemetry, opts])

  return { speedBand, altBand, headingTrack, smoothness }
}
