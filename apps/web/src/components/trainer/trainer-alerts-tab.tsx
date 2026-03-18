'use client'

import { useState, useEffect, useRef } from 'react'
import { supabase } from '@/lib/supabase'
import { getChannelName, ALERT_THRESHOLD_META, DEFAULT_ALERT_RULES } from '@jarvis-dcs/shared'
import type { AlertSeverity, AlertThresholdMeta } from '@jarvis-dcs/shared'
import { ObserverGuard } from './observer-guard'

interface AlertRowState {
  enabled: boolean
  threshold: number
  severity: AlertSeverity
}

type AlertConfigMap = Map<string, AlertRowState>

function initAlertConfig(): AlertConfigMap {
  const map: AlertConfigMap = new Map()
  for (const meta of ALERT_THRESHOLD_META) {
    const base = DEFAULT_ALERT_RULES.find(r => r.id === meta.ruleId)
    map.set(meta.ruleId, {
      enabled: true,
      threshold: meta.defaultValue,
      severity: base?.severity ?? 'warning',
    })
  }
  return map
}

interface TrainerAlertsTabProps {
  sessionId: string
}

export function TrainerAlertsTab({ sessionId }: TrainerAlertsTabProps) {
  const [config, setConfig] = useState<AlertConfigMap>(initAlertConfig)
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null)

  // Set up broadcast channel
  useEffect(() => {
    const channelName = getChannelName(sessionId)
    const channel = supabase.channel(channelName, {
      config: { broadcast: { ack: false } },
    })
    channel.subscribe()
    channelRef.current = channel

    return () => {
      supabase.removeChannel(channel)
      channelRef.current = null
    }
  }, [sessionId])

  function broadcastAlert(ruleId: string, state: AlertRowState) {
    const channel = channelRef.current
    if (!channel) return
    channel.send({
      type: 'broadcast',
      event: 'config_alert',
      payload: {
        ruleId,
        enabled: state.enabled,
        threshold: state.threshold,
        severity: state.severity,
      },
    })
  }

  function updateAndBroadcast(ruleId: string, patch: Partial<AlertRowState>) {
    setConfig(prev => {
      const next = new Map(prev)
      const current = next.get(ruleId)!
      const updated = { ...current, ...patch }
      next.set(ruleId, updated)
      broadcastAlert(ruleId, updated)
      return next
    })
  }

  const TOGGLE_STYLE = (enabled: boolean): React.CSSProperties => ({
    width: '24px',
    height: '12px',
    background: enabled ? '#00ffff' : 'rgba(0,212,255,0.15)',
    border: `1px solid ${enabled ? '#00ffff' : 'rgba(0,212,255,0.3)'}`,
    borderRadius: '2px',
    cursor: 'pointer',
    flexShrink: 0,
    position: 'relative',
    transition: 'background 0.15s, border-color 0.15s',
  })

  const TOGGLE_DOT = (enabled: boolean): React.CSSProperties => ({
    position: 'absolute',
    top: '1px',
    left: enabled ? '11px' : '1px',
    width: '8px',
    height: '8px',
    background: enabled ? '#000d1a' : 'rgba(0,212,255,0.5)',
    borderRadius: '1px',
    transition: 'left 0.15s',
  })

  const SEV_COLORS: Record<AlertSeverity, string> = {
    info: '#00ffff',
    warning: '#ffaa00',
    critical: '#ff4444',
  }

  return (
    <ObserverGuard>
    <div
      style={{
        height: '100%',
        overflowY: 'auto',
        padding: '6px 8px',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {ALERT_THRESHOLD_META.map((meta: AlertThresholdMeta) => {
        const state = config.get(meta.ruleId)!
        const dimmed = !state.enabled

        return (
          <div
            key={meta.ruleId}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              height: '28px',
              opacity: dimmed ? 0.3 : 1,
              transition: 'opacity 0.15s',
            }}
          >
            {/* Toggle */}
            <div
              style={TOGGLE_STYLE(state.enabled)}
              onClick={() => updateAndBroadcast(meta.ruleId, { enabled: !state.enabled })}
              title={state.enabled ? 'Disable alert' : 'Enable alert'}
            >
              <div style={TOGGLE_DOT(state.enabled)} />
            </div>

            {/* Label */}
            <div
              style={{
                fontSize: '7px',
                letterSpacing: '1.5px',
                color: 'rgba(0,212,255,0.6)',
                width: '80px',
                flexShrink: 0,
                overflow: 'hidden',
                whiteSpace: 'nowrap',
              }}
            >
              {meta.label}
            </div>

            {/* Slider */}
            <input
              type="range"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={state.threshold}
              disabled={!state.enabled}
              onChange={e => updateAndBroadcast(meta.ruleId, { threshold: parseFloat(e.target.value) })}
              style={{
                flex: 1,
                accentColor: '#00ffff',
                cursor: state.enabled ? 'pointer' : 'not-allowed',
                minWidth: 0,
              }}
            />

            {/* Number input */}
            <input
              type="number"
              min={meta.min}
              max={meta.max}
              step={meta.step}
              value={state.threshold}
              disabled={!state.enabled}
              onChange={e => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                  updateAndBroadcast(meta.ruleId, {
                    threshold: Math.max(meta.min, Math.min(meta.max, val)),
                  })
                }
              }}
              style={{
                width: '38px',
                background: 'transparent',
                border: '1px solid rgba(0,212,255,0.2)',
                color: '#00d4ff',
                fontFamily: 'Courier New, monospace',
                fontSize: '8px',
                letterSpacing: '1px',
                padding: '1px 3px',
                textAlign: 'center',
                outline: 'none',
              }}
            />

            {/* Unit label */}
            <div
              style={{
                fontSize: '7px',
                color: 'rgba(0,212,255,0.4)',
                width: '16px',
                flexShrink: 0,
              }}
            >
              {meta.unit}
            </div>

            {/* Severity buttons */}
            <div style={{ display: 'flex', gap: '2px', flexShrink: 0 }}>
              {(['info', 'warning', 'critical'] as AlertSeverity[]).map(sev => (
                <button
                  key={sev}
                  disabled={!state.enabled}
                  onClick={() => updateAndBroadcast(meta.ruleId, { severity: sev })}
                  style={{
                    width: '14px',
                    height: '14px',
                    background: state.severity === sev ? SEV_COLORS[sev] + '22' : 'transparent',
                    border: `1px solid ${state.severity === sev ? SEV_COLORS[sev] : 'rgba(0,212,255,0.15)'}`,
                    color: state.severity === sev ? SEV_COLORS[sev] : 'rgba(0,212,255,0.3)',
                    fontFamily: 'Courier New, monospace',
                    fontSize: '7px',
                    letterSpacing: 0,
                    cursor: state.enabled ? 'pointer' : 'not-allowed',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: 0,
                    transition: 'background 0.1s, border-color 0.1s, color 0.1s',
                  }}
                  title={sev}
                >
                  {sev === 'info' ? 'I' : sev === 'warning' ? 'W' : 'C'}
                </button>
              ))}
            </div>
          </div>
        )
      })}
    </div>
    </ObserverGuard>
  )
}
