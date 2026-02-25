'use client'

import type { CoachingBand, SmoothnessScore } from '@/hooks/use-coaching'

interface CoachingPanelProps {
  speedBand: CoachingBand
  altBand: CoachingBand
  headingTrack: CoachingBand
  smoothness: SmoothnessScore
  className?: string
}

interface BandIndicatorProps {
  band: CoachingBand
  label: string
  unit: string
  decimals?: number
}

function BandIndicator({ band, label, unit, decimals = 0 }: BandIndicatorProps) {
  const statusColor =
    band.status === 'in-band'
      ? 'text-jarvis-success'
      : band.status === 'no-data'
        ? 'text-jarvis-muted opacity-40'
        : 'text-jarvis-warning'

  const deviationColor = band.deviation === null ? 'text-jarvis-muted opacity-40' :
    Math.abs(band.deviation) <= band.tolerance ? 'text-jarvis-success' :
    Math.abs(band.deviation) <= band.tolerance * 1.5 ? 'text-jarvis-warning' :
    'text-jarvis-danger'

  return (
    <div className="jarvis-panel">
      <div className="panel-title">{label}</div>
      <div className="flex items-center justify-between mt-1">
        {/* Current value */}
        <div>
          <span className={`text-lg font-bold tabular-nums ${statusColor}`}>
            {band.current !== null ? band.current.toFixed(decimals) : '---'}
          </span>
          <span className={`text-[10px] ml-1 opacity-50`}>{unit}</span>
        </div>

        {/* Target indicator */}
        <div className="text-right">
          <div className="text-[10px] opacity-40">TARGET</div>
          <div className="text-sm font-bold text-jarvis-accent">
            {band.target.toFixed(decimals)}
          </div>
        </div>
      </div>

      {/* Deviation bar */}
      <div className="mt-2 h-2 bg-jarvis-bar rounded overflow-hidden">
        <div
          className={`h-full transition-all duration-300 ${
            band.status === 'in-band'
              ? 'bg-jarvis-success'
              : band.status === 'no-data'
                ? 'bg-jarvis-muted opacity-20'
                : 'bg-jarvis-warning'
          }`}
          style={{
            width: band.status === 'no-data'
              ? '0%'
              : `${Math.min(100, (Math.abs(band.deviation ?? 0) / band.tolerance) * 50)}%`,
            marginLeft: band.deviation === null || band.deviation >= 0 ? '0' : 'auto',
            marginRight: band.deviation !== null && band.deviation < 0 ? '0' : 'auto',
          }}
        />
      </div>

      {/* Deviation text */}
      {band.deviation !== null && (
        <div className={`text-[10px] mt-1 text-right ${deviationColor}`}>
          {band.deviation > 0 ? '+' : ''}{band.deviation.toFixed(decimals)}
        </div>
      )}
    </div>
  )
}

interface SmoothnessGaugeProps {
  score: number
  current: number
}

function SmoothnessGauge({ score, current }: SmoothnessGaugeProps) {
  const color =
    score >= 80
      ? 'text-jarvis-success glow-success'
      : score >= 50
        ? 'text-jarvis-warning'
        : 'text-jarvis-danger'

  return (
    <div className="jarvis-panel">
      <div className="panel-title">▸ SMOOTHNESS</div>
      <div className="flex flex-col items-center mt-2">
        {/* Score circle */}
        <div
          className={`
            w-20 h-20 rounded-full flex items-center justify-center
            border-2 ${score >= 80 ? 'border-jarvis-success' : score >= 50 ? 'border-jarvis-warning' : 'border-jarvis-danger'}
          `}
          style={{ background: 'rgba(0, 13, 26, 0.8)' }}
        >
          <span className={`text-2xl font-bold tabular-nums ${color}`}>
            {score}
          </span>
        </div>

        {/* Current angular velocity */}
        <div className="mt-2 text-[10px] opacity-50" style={{ letterSpacing: '1px' }}>
          ANG VEL: <span className="text-jarvis-accent">{(current * 57.3).toFixed(2)}°/s</span>
        </div>
      </div>
    </div>
  )
}

export function CoachingPanel({
  speedBand,
  altBand,
  headingTrack,
  smoothness,
  className = '',
}: CoachingPanelProps) {
  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        <div className="panel-title px-1">▸ FLIGHT COACHING</div>

        <BandIndicator band={speedBand} label="SPEED" unit="KT" />
        <BandIndicator band={altBand} label="ALTITUDE" unit="FT" />
        <BandIndicator band={headingTrack} label="HEADING" unit="°" decimals={0} />

        <SmoothnessGauge score={smoothness.score} current={smoothness.currentAngVel} />
      </div>
    </div>
  )
}
