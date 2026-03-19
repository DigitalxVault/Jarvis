'use client'

import { RadarScope } from '@/components/tactical/radar-scope'
import type { TelemetryPacket, TacticalPacket } from '@jarvis-dcs/shared'

const TRAINER_RANGE_OPTIONS = [5, 10, 20] as const

interface TrainerTSDProps {
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
  /** When set, TSD clicks place waypoints instead of cycling range */
  onCanvasClick?: (coords: { lat: number; lon: number }) => void
}

export function TrainerTSD({ telemetry, tactical, onCanvasClick }: TrainerTSDProps) {
  return (
    <div className="flex-1 min-h-0 min-w-0 relative">
      <RadarScope
        telemetry={telemetry}
        tactical={tactical}
        rangeOptions={TRAINER_RANGE_OPTIONS}
        onCanvasClick={onCanvasClick}
      />
    </div>
  )
}
