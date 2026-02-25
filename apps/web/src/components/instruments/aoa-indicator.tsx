'use client'

import { radToDegSigned } from '@/lib/conversions'

interface AoAIndicatorProps {
  aoaRad: number
  className?: string
}

// F-16 AoA indexer zones (in degrees)
const ON_SPEED_MIN = 8
const ON_SPEED_MAX = 13
const STALL_WARNING = 15

export function AoAIndicator({ aoaRad, className = '' }: AoAIndicatorProps) {
  const aoaDeg = Math.abs(radToDegSigned(aoaRad))
  const isOnSpeed = aoaDeg >= ON_SPEED_MIN && aoaDeg <= ON_SPEED_MAX
  const isSlow = aoaDeg < ON_SPEED_MIN
  const isFast = aoaDeg > ON_SPEED_MAX
  const isStall = aoaDeg >= STALL_WARNING

  // Determine indicator state
  let topSymbol: string
  let middleSymbol: string
  let bottomSymbol: string

  if (isStall) {
    // All red for stall
    topSymbol = '▲'
    middleSymbol = '●'
    bottomSymbol = '▲'
  } else if (isFast) {
    // Chevron up (too slow/high AoA)
    topSymbol = '▲'
    middleSymbol = '○'
    bottomSymbol = ' '
  } else if (isSlow) {
    // Chevron down (too fast/low AoA)
    topSymbol = ' '
    middleSymbol = '○'
    bottomSymbol = '▼'
  } else {
    // On speed (donut)
    topSymbol = ' '
    middleSymbol = '●'
    bottomSymbol = ' '
  }

  const colorClass = isStall
    ? 'text-jarvis-danger glow-danger'
    : isOnSpeed
      ? 'text-jarvis-success glow-success'
      : 'text-jarvis-accent'

  return (
    <div className={className}>
      <div className="jarvis-panel">
        <div className="panel-title">▸ ANGLE OF ATTACK</div>

        {/* Indexer display */}
        <div className="flex justify-center gap-6 my-3">
          <div className={`text-2xl ${colorClass}`}>{topSymbol}</div>
          <div className={`text-2xl ${colorClass}`}>{middleSymbol}</div>
          <div className={`text-2xl ${colorClass}`}>{bottomSymbol}</div>
        </div>

        {/* Numeric AoA */}
        <div className="text-center">
          <div
            className={`text-4xl font-bold tabular-nums ${
              isStall
                ? 'text-jarvis-danger glow-danger'
                : isFast
                  ? 'text-jarvis-warning'
                  : isOnSpeed
                    ? 'text-jarvis-success glow-success'
                    : 'text-jarvis-accent'
            }`}
            style={{ letterSpacing: '2px' }}
          >
            {aoaDeg.toFixed(1)}°
          </div>
        </div>

        {/* Zone labels */}
        <div className="flex justify-between mt-2 text-[9px] opacity-40" style={{ letterSpacing: '1px' }}>
          <span>FAST</span>
          <span>ON SPEED</span>
          <span>SLOW</span>
        </div>

        {/* Stall warning */}
        {isStall && (
          <div className="mt-2 text-center animate-blink">
            <span className="text-[11px] text-jarvis-danger font-bold" style={{ letterSpacing: '3px' }}>
              ▲ STALL WARNING ▲
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
