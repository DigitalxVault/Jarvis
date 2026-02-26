'use client'

interface FuelGaugeProps {
  internal: number  // 0-1 fraction
  external: number  // 0-1 fraction
  className?: string
}

function getFuelColor(level: number): string {
  if (level >= 0.5) return '#00ff88'  // green
  if (level >= 0.3) return '#ffaa00'  // amber
  return '#ff4444'  // red
}

export function FuelGauge({ internal, external, className = '' }: FuelGaugeProps) {
  const internalPct = Math.max(0, Math.min(100, internal * 100))
  const externalPct = Math.max(0, Math.min(100, external * 100))
  const bingoPct = 30

  return (
    <div className={className}>
      <div className="jarvis-panel p-1.5">
        <div className="panel-title">▸ FUEL</div>

        <div className="flex gap-3 mt-1.5">
          {/* Internal fuel */}
          <div className="flex-1 flex flex-col items-center">
            <div
              className="text-[10px] opacity-50 mb-0.5"
              style={{ letterSpacing: '2px' }}
            >
              INT
            </div>
            <div className="relative w-8 h-20 bg-jarvis-bar border border-jarvis-border rounded">
              {/* Bingo line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-jarvis-warning z-10"
                style={{ bottom: `${bingoPct}%` }}
              />
              {/* Fill */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-200"
                style={{
                  height: `${internalPct}%`,
                  backgroundColor: getFuelColor(internal),
                  opacity: 0.7,
                }}
              />
              {/* Percentage marks */}
              {[100, 75, 50, 25, 0].map((mark) => (
                <div
                  key={mark}
                  className="absolute left-0 right-0 border-t border-jarvis-border/30"
                  style={{ bottom: `${mark}%` }}
                />
              ))}
            </div>
            <div
              className={`text-xs font-bold tabular-nums ${
                internal < 0.3 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-accent'
              }`}
              style={{ letterSpacing: '1px' }}
            >
              {internalPct.toFixed(0)}%
            </div>
          </div>

          {/* External fuel */}
          <div className="flex-1 flex flex-col items-center">
            <div
              className="text-[10px] opacity-50 mb-0.5"
              style={{ letterSpacing: '2px' }}
            >
              EXT
            </div>
            <div className="relative w-8 h-20 bg-jarvis-bar border border-jarvis-border rounded">
              {/* Bingo line */}
              <div
                className="absolute left-0 right-0 border-t-2 border-dashed border-jarvis-warning z-10"
                style={{ bottom: `${bingoPct}%` }}
              />
              {/* Fill */}
              <div
                className="absolute bottom-0 left-0 right-0 transition-all duration-200"
                style={{
                  height: `${externalPct}%`,
                  backgroundColor: getFuelColor(external),
                  opacity: 0.7,
                }}
              />
              {/* Percentage marks */}
              {[100, 75, 50, 25, 0].map((mark) => (
                <div
                  key={mark}
                  className="absolute left-0 right-0 border-t border-jarvis-border/30"
                  style={{ bottom: `${mark}%` }}
                />
              ))}
            </div>
            <div
              className={`text-xs font-bold tabular-nums ${
                external < 0.3 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-accent'
              }`}
              style={{ letterSpacing: '1px' }}
            >
              {externalPct.toFixed(0)}%
            </div>
          </div>
        </div>

        {/* Bingo label */}
        <div className="mt-1 text-center">
          <span className="text-[10px] text-jarvis-warning" style={{ letterSpacing: '2px' }}>
            BINGO @ {bingoPct}%
          </span>
        </div>
      </div>
    </div>
  )
}
