'use client'

import type { ActiveAlert } from '@jarvis-dcs/shared'
import { getAlertColorClass } from '@/hooks/use-alerts'

interface AlertOverlayProps {
  alerts: ActiveAlert[]
  className?: string
}

export function AlertOverlay({ alerts, className = '' }: AlertOverlayProps) {
  if (alerts.length === 0) return null

  // Prioritize critical alerts, then warnings, then info
  const sortedAlerts = [...alerts].sort((a, b) => {
    const severityOrder = { critical: 0, warning: 1, info: 2 }
    return severityOrder[a.severity] - severityOrder[b.severity]
  })

  const primaryAlert = sortedAlerts[0]
  const colorClass = getAlertColorClass(primaryAlert.severity)

  return (
    <div className={`${className} alert-overlay`}>
      <div
        className={`
          border-l-4 border-r-4 px-6 py-3 text-center
          ${colorClass}
        `}
        style={{ letterSpacing: '3px' }}
      >
        <div className="text-[14px] font-bold animate-blink">
          {primaryAlert.message}
        </div>

        {/* Secondary alerts as smaller text below */}
        {sortedAlerts.length > 1 && (
          <div className="mt-1 text-[10px] opacity-70">
            {sortedAlerts.slice(1).map((a) => a.message).join(' • ')}
          </div>
        )}
      </div>

      {/* Alert indicator dots */}
      <div className="flex gap-1 mt-2">
        {sortedAlerts.map((alert) => (
          <div
            key={alert.ruleId}
            className={`
              w-2 h-2 rounded-full animate-pulse
              ${alert.severity === 'critical' ? 'bg-jarvis-danger glow-danger' : ''}
              ${alert.severity === 'warning' ? 'bg-jarvis-warning' : ''}
              ${alert.severity === 'info' ? 'bg-jarvis-accent' : ''}
            `}
          />
        ))}
      </div>
    </div>
  )
}
