'use client'

export type MiniCardColor = 'primary' | 'accent' | 'success' | 'warning' | 'danger'

interface MiniTelemetryCardProps {
  label: string
  value: string
  unit?: string
  color?: MiniCardColor
}

const colorClasses: Record<MiniCardColor, string> = {
  primary: 'text-jarvis-primary glow-primary',
  accent: 'text-jarvis-accent glow-accent',
  success: 'text-jarvis-success glow-success',
  warning: 'text-jarvis-warning',
  danger: 'text-jarvis-danger',
}

const borderClasses: Record<MiniCardColor, string> = {
  primary: 'border-jarvis-primary/30',
  accent: 'border-jarvis-accent/30',
  success: 'border-jarvis-success/30',
  warning: 'border-jarvis-warning/30',
  danger: 'border-jarvis-danger/30',
}

export function MiniTelemetryCard({
  label,
  value,
  unit,
  color = 'accent'
}: MiniTelemetryCardProps) {
  return (
    <div className={`border ${borderClasses[color]} rounded bg-jarvis-panel/50 px-2 py-1.5 min-w-[60px]`}>
      <div className="text-[9px] opacity-40 tracking-wider">{label}</div>
      <div className={`text-lg font-bold ${colorClasses[color]} tabular-nums`} style={{ letterSpacing: '1px' }}>
        {value}
      </div>
      {unit && (
        <div className="text-[9px] opacity-30">{unit}</div>
      )}
    </div>
  )
}
