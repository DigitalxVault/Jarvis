'use client'

import { useState, useEffect } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName, DEFAULT_ALERT_RULES, ALERT_THRESHOLD_META } from '@jarvis-dcs/shared'
import type { AlertRule, ConfigAlertPayload } from '@jarvis-dcs/shared'

interface UseAlertConfigReturn {
  rules: AlertRule[]
}

/**
 * Player-side hook that listens for config_alert broadcasts from the trainer
 * and rebuilds the alert rule set with overridden thresholds/severity.
 *
 * Flow: Trainer dashboard -> Supabase broadcast (event: 'config_alert')
 *       -> this hook -> returns overridden rules -> useAlerts uses them.
 *
 * The bridge is NOT involved in this loop.
 */
export function useAlertConfig(sessionId: string | null): UseAlertConfigReturn {
  const [rules, setRules] = useState<AlertRule[]>(DEFAULT_ALERT_RULES)

  useEffect(() => {
    if (!sessionId) {
      // Reset to defaults when session is cleared
      setRules(DEFAULT_ALERT_RULES)  // eslint-disable-line react-hooks/set-state-in-effect
      return
    }

    // Map of ruleId -> override payload from trainer
    const overrides = new Map<string, ConfigAlertPayload>()

    const channelName = getChannelName(sessionId)
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    })

    channel.on('broadcast', { event: 'config_alert' }, (msg) => {
      const payload = msg.payload as ConfigAlertPayload
      if (!payload?.ruleId) return

      overrides.set(payload.ruleId, payload)
      setRules(buildRules(overrides))
    })

    channel.subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [sessionId])

  return { rules }
}

/**
 * Rebuild the alert rules array from DEFAULT_ALERT_RULES with overrides applied.
 * - enabled === false → rule removed entirely
 * - threshold provided → test function replaced with threshold-converted version
 * - severity provided → severity overridden
 */
function buildRules(overrides: Map<string, ConfigAlertPayload>): AlertRule[] {
  const result: AlertRule[] = []

  for (const base of DEFAULT_ALERT_RULES) {
    const override = overrides.get(base.id)

    // Remove rule if disabled
    if (override?.enabled === false) continue

    // Find threshold metadata for unit conversion
    const meta = ALERT_THRESHOLD_META.find(m => m.ruleId === base.id)

    let test = base.test
    let severity = base.severity

    if (override) {
      // Override severity
      if (override.severity) {
        severity = override.severity
      }

      // Override test function with new threshold
      if (override.threshold !== undefined && meta) {
        const threshold = override.threshold
        test = buildTestFunction(base.id, threshold)
      }
    }

    result.push({ ...base, test, severity })
  }

  return result
}

/**
 * Build a new test function for the given ruleId with the threshold value
 * from the trainer UI (in display units — ft, G, deg, %, kts).
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildTestFunction(ruleId: string, threshold: number): (t: any) => boolean {
  switch (ruleId) {
    case 'pull_up': {
      // threshold in ft → convert to metres
      const thresholdM = threshold * 0.3048
      return (t) => (t.pos?.alt_agl_m ?? 9999) < thresholdM
    }
    case 'over_g': {
      // threshold in G, direct
      return (t) => (t.aero?.g?.y ?? 0) > threshold
    }
    case 'stall': {
      // threshold in degrees → convert to radians
      const thresholdRad = threshold * Math.PI / 180
      return (t) => Math.abs(t.aero?.aoa_rad ?? 0) > thresholdRad
    }
    case 'bingo_fuel': {
      // threshold in % → convert to fraction
      return (t) => (t.fuel?.internal ?? 1) < threshold / 100
    }
    case 'low_speed': {
      // threshold in knots → convert to m/s
      const thresholdMps = threshold * 0.5144
      return (t) => (t.spd?.ias_mps ?? 999) < thresholdMps
    }
    case 'high_aoa': {
      // threshold in degrees → convert to radians
      const thresholdRad = threshold * Math.PI / 180
      return (t) => Math.abs(t.aero?.aoa_rad ?? 0) > thresholdRad
    }
    case 'negative_g': {
      // threshold in G (negative value), direct
      return (t) => (t.aero?.g?.y ?? 1) < threshold
    }
    default:
      // Unknown rule: keep original behaviour (always false = no alert)
      return () => false
  }
}
