'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import type { TelemetryPacket } from '@jarvis-dcs/shared'
import { DEFAULT_ALERT_RULES, type ActiveAlert, type AlertRule } from '@jarvis-dcs/shared'

interface UseAlertsOptions {
  rules?: AlertRule[]
  /** If false, hook processes telemetry but doesn't return alerts (muted) */
  enabled?: boolean
}

interface AlertState {
  alerts: ActiveAlert[]
  hasCritical: boolean
  hasWarning: boolean
}

export function useAlerts(
  telemetry: TelemetryPacket | null,
  options: UseAlertsOptions = {}
): AlertState {
  const { rules = DEFAULT_ALERT_RULES, enabled = true } = options

  const [alerts, setAlerts] = useState<ActiveAlert[]>([])
  const triggeredRef = useRef<Map<string, number>>(new Map())
  const debounceTimeoutsRef = useRef<Map<string, NodeJS.Timeout>>(new Map())

  // Clear alerts when telemetry goes stale
  useEffect(() => {
    if (!telemetry) {
      setAlerts([])
      triggeredRef.current.clear()
      debounceTimeoutsRef.current.forEach((timeout) => clearTimeout(timeout))
      debounceTimeoutsRef.current.clear()
    }
  }, [telemetry])

  // Process telemetry for alerts
  useEffect(() => {
    if (!telemetry || !enabled) return

    const now = Date.now()
    const newTriggered = new Map<string, number>()
    const newAlerts: ActiveAlert[] = []

    rules.forEach((rule) => {
      const shouldTrigger = rule.test(telemetry)

      if (shouldTrigger) {
        // Check debounce
        const lastTriggered = triggeredRef.current.get(rule.id)
        const debounceElapsed = lastTriggered ? now - lastTriggered : Infinity
        const debounceMs = rule.debounceMs ?? 0

        if (debounceElapsed >= debounceMs) {
          newTriggered.set(rule.id, now)
          newAlerts.push({
            ruleId: rule.id,
            message: rule.message,
            severity: rule.severity,
            triggeredAt: now,
          })

          // Clear any pending debounce timeout
          const existingTimeout = debounceTimeoutsRef.current.get(rule.id)
          if (existingTimeout) {
            clearTimeout(existingTimeout)
            debounceTimeoutsRef.current.delete(rule.id)
          }
        } else {
          // Still in debounce, keep old alert if exists
          const existingAlert = alerts.find((a) => a.ruleId === rule.id)
          if (existingAlert) {
            newAlerts.push(existingAlert)
          }
        }
      }
    })

    // Clear alerts that are no longer triggered
    triggeredRef.current.forEach((triggeredAt, ruleId) => {
      if (!newTriggered.has(ruleId)) {
        // Alert cleared, set up debounce to re-arm
        const rule = rules.find((r) => r.id === ruleId)
        if (rule?.debounceMs) {
          const timeout = setTimeout(() => {
            triggeredRef.current.delete(ruleId)
          }, rule.debounceMs)
          debounceTimeoutsRef.current.set(ruleId, timeout)
        } else {
          triggeredRef.current.delete(ruleId)
        }
      }
    })

    // Update triggered times
    newTriggered.forEach((time, ruleId) => {
      triggeredRef.current.set(ruleId, time)
    })

    setAlerts(newAlerts)
  }, [telemetry, enabled, rules])

  const hasCritical = alerts.some((a) => a.severity === 'critical')
  const hasWarning = alerts.some((a) => a.severity === 'warning')

  return { alerts, hasCritical, hasWarning }
}

/** Get color class for alert severity */
export function getAlertColorClass(severity: string): string {
  switch (severity) {
    case 'critical':
      return 'text-jarvis-danger glow-danger bg-jarvis-danger/10 border-jarvis-danger'
    case 'warning':
      return 'text-jarvis-warning glow-warning bg-jarvis-warning/10 border-jarvis-warning'
    default:
      return 'text-jarvis-accent glow-accent bg-jarvis-accent/10 border-jarvis-accent'
  }
}
