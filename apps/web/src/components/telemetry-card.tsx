'use client'

interface TelemetryCardProps {
  label: string
  value: number | null
  unit: string
  decimals?: number
  formatFn?: (v: number) => string
}

export function TelemetryCard({ label, value, unit, decimals = 0, formatFn }: TelemetryCardProps) {
  const displayValue = value !== null
    ? (formatFn ? formatFn(value) : value.toFixed(decimals))
    : '---'

  return (
    <div className="jarvis-panel flex flex-col items-center justify-center min-h-[140px]">
      <div className="panel-title">▸ {label}</div>
      <div
        className="text-4xl font-bold text-jarvis-accent glow-accent mt-2 tabular-nums"
        style={{ letterSpacing: '2px' }}
      >
        {displayValue}
      </div>
      <div
        className="text-[11px] opacity-50 mt-2"
        style={{ letterSpacing: '2px' }}
      >
        {unit}
      </div>
    </div>
  )
}
