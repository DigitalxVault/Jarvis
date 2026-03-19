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
      {/* Overlay when no player telemetry available */}
      {!telemetry && (
        <div
          className="absolute inset-0 flex items-center justify-center pointer-events-none"
          style={{ zIndex: 1 }}
        >
          <span
            className="text-jarvis-accent"
            style={{ fontSize: '14px', letterSpacing: '3px', opacity: 0.3 }}
          >
            AWAITING PLAYER POSITION
          </span>
        </div>
      )}
    </div>
  )
}
