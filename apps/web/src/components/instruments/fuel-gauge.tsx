'use client'

// F-16C fuel capacities (kg)
const INTERNAL_MAX_KG = 3200
const EXTERNAL_MAX_KG = 1400

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

  const internalKg = Math.round(internal * INTERNAL_MAX_KG)
  const externalKg = Math.round(external * EXTERNAL_MAX_KG)
  const totalKg = internalKg + externalKg

  return (
    <div className={className}>
      <div className="jarvis-panel p-2.5">
        <div className="panel-title">▸ FUEL</div>

        {/* Total fuel readout */}
        <div className="text-center mt-1 mb-2">
          <span className={`text-xl font-bold tabular-nums ${
            internal < 0.3 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-accent glow-accent'
          }`}>
            {totalKg.toLocaleString()}
          </span>
          <span className="text-[10px] opacity-50 ml-1">KG</span>
        </div>

        <div className="flex gap-4 justify-center">
          {/* Internal fuel */}
          <div className="flex flex-col items-center">
            <div
              className="text-[11px] opacity-50 mb-1"
              style={{ letterSpacing: '2px' }}
            >
              INT
            </div>
            <div className="relative w-14 h-28 bg-jarvis-bar border border-jarvis-border rounded">
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
              className={`text-sm font-bold tabular-nums mt-1 ${
                internal < 0.3 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-accent'
              }`}
              style={{ letterSpacing: '1px' }}
            >
              {internalPct.toFixed(0)}%
            </div>
            <div className="text-[10px] opacity-40 tabular-nums">{internalKg} kg</div>
          </div>

          {/* External fuel */}
          <div className="flex flex-col items-center">
            <div
              className="text-[11px] opacity-50 mb-1"
              style={{ letterSpacing: '2px' }}
            >
              EXT
            </div>
            <div className="relative w-14 h-28 bg-jarvis-bar border border-jarvis-border rounded">
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
              className={`text-sm font-bold tabular-nums mt-1 ${
                external < 0.3 ? 'text-jarvis-danger glow-danger' : 'text-jarvis-accent'
              }`}
              style={{ letterSpacing: '1px' }}
            >
              {externalPct.toFixed(0)}%
            </div>
            <div className="text-[10px] opacity-40 tabular-nums">{externalKg} kg</div>
          </div>
        </div>

        {/* Bingo label */}
        <div className="mt-2 text-center">
          <span className="text-[10px] text-jarvis-warning" style={{ letterSpacing: '2px' }}>
            BINGO @ {bingoPct}%
          </span>
        </div>
      </div>
    </div>
  )
}
