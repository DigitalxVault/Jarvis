'use client'

import { RadarScope } from '@/components/tactical/radar-scope'
import type { TelemetryPacket, TacticalPacket } from '@jarvis-dcs/shared'

const TRAINER_RANGE_OPTIONS = [5, 10, 20] as const

interface TrainerTSDProps {
  telemetry: TelemetryPacket | null
  tactical: TacticalPacket | null
}

export function TrainerTSD({ telemetry, tactical }: TrainerTSDProps) {
  return (
    <div className="flex-1 min-h-0 min-w-0">
      <RadarScope
        telemetry={telemetry}
        tactical={tactical}
        rangeOptions={TRAINER_RANGE_OPTIONS}
      />
    </div>
  )
}
