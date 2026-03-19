'use client'

import { useState, useCallback } from 'react'
import { useDcsCommands } from '@/hooks/use-dcs-commands'
import { useToast } from '@/components/toast-notification'
import { ConfirmModal } from '@/components/confirm-modal'
import { ObserverGuard } from './observer-guard'
import type { TelemetryPacket, MissionWaypoint } from '@jarvis-dcs/shared'

type MissionMode = 'quick' | 'route'
type ObjectiveType = 'Strike' | 'Defend' | 'Recon'

interface QuickInjectState {
  lat: string
  lon: string
  altitude_ft: string
  name: string
  objectiveType: ObjectiveType
  briefing: string
}

interface RouteWaypoint {
  id: string
  lat: string
  lon: string
  altitude_ft: string
  name: string
  objectiveType: ObjectiveType
}

interface TrainerMissionTabProps {
  sessionId: string
  telemetry: TelemetryPacket | null
  onSetTsdClickHandler?: (handler: ((coords: { lat: number; lon: number }) => void) | null) => void
}

const EMPTY_QUICK: QuickInjectState = {
  lat: '',
  lon: '',
  altitude_ft: '20000',
  name: 'WP-1',
  objectiveType: 'Strike',
  briefing: '',
}

function makeRouteWp(): RouteWaypoint {
  return {
    id: crypto.randomUUID(),
    lat: '',
    lon: '',
    altitude_ft: '20000',
    name: 'WP',
    objectiveType: 'Strike',
  }
}

// Shared input style
const INPUT_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0,212,255,0.2)',
  color: '#00d4ff',
  fontFamily: 'Courier New, monospace',
  fontSize: '11px',
  letterSpacing: '1px',
  padding: '3px 4px',
  outline: 'none',
  width: '100%',
  boxSizing: 'border-box',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '11px',
  letterSpacing: '2px',
  color: 'rgba(0,212,255,0.5)',
  marginBottom: '2px',
  display: 'block',
}

const OBJ_TYPES: ObjectiveType[] = ['Strike', 'Defend', 'Recon']

export function TrainerMissionTab({ sessionId, telemetry, onSetTsdClickHandler }: TrainerMissionTabProps) {
  const [mode, setMode] = useState<MissionMode>('quick')
  const [quick, setQuick] = useState<QuickInjectState>(EMPTY_QUICK)
  const [waypoints, setWaypoints] = useState<RouteWaypoint[]>([makeRouteWp()])
  const [routeBriefing, setRouteBriefing] = useState('')
  const [placing, setPlacing] = useState(false)
  const [placingRouteId, setPlacingRouteId] = useState<string | null>(null)
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [pendingInject, setPendingInject] = useState<(() => void) | null>(null)
  const [confirmMsg, setConfirmMsg] = useState('')

  const { sendCommand } = useDcsCommands(sessionId)
  const { showToast } = useToast()

  // ── TSD click-to-place handlers ──

  const handleQuickPlaceToggle = useCallback(() => {
    if (placing && placingRouteId === null) {
      // Deactivate
      setPlacing(false)
      onSetTsdClickHandler?.(null)
    } else {
      // Deactivate any existing route placing
      setPlacingRouteId(null)
      setPlacing(true)
      const handler = (coords: { lat: number; lon: number }) => {
        setQuick(prev => ({
          ...prev,
          lat: coords.lat.toFixed(6),
          lon: coords.lon.toFixed(6),
        }))
        setPlacing(false)
        onSetTsdClickHandler?.(null)
      }
      onSetTsdClickHandler?.(handler)
    }
  }, [placing, placingRouteId, onSetTsdClickHandler])

  const handleRoutePlaceToggle = useCallback((wpId: string) => {
    if (placing && placingRouteId === wpId) {
      // Deactivate
      setPlacing(false)
      setPlacingRouteId(null)
      onSetTsdClickHandler?.(null)
    } else {
      setPlacing(true)
      setPlacingRouteId(wpId)
      const handler = (coords: { lat: number; lon: number }) => {
        setWaypoints(prev =>
          prev.map(wp =>
            wp.id === wpId
              ? { ...wp, lat: coords.lat.toFixed(6), lon: coords.lon.toFixed(6) }
              : wp
          )
        )
        setPlacing(false)
        setPlacingRouteId(null)
        onSetTsdClickHandler?.(null)
      }
      onSetTsdClickHandler?.(handler)
    }
  }, [placing, placingRouteId, onSetTsdClickHandler])

  // ── Inject helpers ──

  function showConfirm(message: string, action: () => void) {
    setConfirmMsg(message)
    setPendingInject(() => action)
    setConfirmOpen(true)
  }

  async function executeInject(wpList: MissionWaypoint[], briefing: string) {
    try {
      const result = await sendCommand('inject_waypoint', { waypoints: wpList, briefing: briefing || undefined })
      showToast(result.message, result.success ? 'success' : 'error')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Inject failed', 'error')
    }
  }

  function handleQuickInject() {
    const lat = parseFloat(quick.lat)
    const lon = parseFloat(quick.lon)
    const alt = parseFloat(quick.altitude_ft)
    if (isNaN(lat) || isNaN(lon)) {
      showToast('Enter valid lat/lon coordinates', 'error')
      return
    }
    const wp: MissionWaypoint = {
      idx: 1,
      lat,
      lon,
      altitude_ft: isNaN(alt) ? 20000 : alt,
      name: quick.name || 'WP-1',
      objectiveType: quick.objectiveType,
    }
    showConfirm(
      `Inject waypoint "${wp.name}" at ${lat.toFixed(4)}, ${lon.toFixed(4)}?`,
      () => executeInject([wp], quick.briefing)
    )
  }

  function handleRouteInject() {
    const valid = waypoints.filter(wp => {
      const lat = parseFloat(wp.lat)
      const lon = parseFloat(wp.lon)
      return !isNaN(lat) && !isNaN(lon)
    })
    if (valid.length === 0) {
      showToast('Add at least one waypoint with valid coordinates', 'error')
      return
    }
    const missionWps: MissionWaypoint[] = valid.map((wp, i) => ({
      idx: i + 1,
      lat: parseFloat(wp.lat),
      lon: parseFloat(wp.lon),
      altitude_ft: parseFloat(wp.altitude_ft) || 20000,
      name: wp.name || `WP-${i + 1}`,
      objectiveType: wp.objectiveType,
    }))
    const names = missionWps.map(w => w.name).join(', ')
    showConfirm(
      `Inject ${missionWps.length} waypoint${missionWps.length !== 1 ? 's' : ''}: ${names}?`,
      () => executeInject(missionWps, routeBriefing)
    )
  }

  // ── Route builder actions ──

  function addWaypoint() {
    const newWp = makeRouteWp()
    setWaypoints(prev => [...prev, newWp])
  }

  function deleteWaypoint(id: string) {
    if (placingRouteId === id) {
      setPlacing(false)
      setPlacingRouteId(null)
      onSetTsdClickHandler?.(null)
    }
    setWaypoints(prev => prev.filter(wp => wp.id !== id))
  }

  function moveWaypoint(id: string, dir: 'up' | 'down') {
    setWaypoints(prev => {
      const idx = prev.findIndex(wp => wp.id === id)
      if (idx === -1) return prev
      const next = [...prev]
      const swapIdx = dir === 'up' ? idx - 1 : idx + 1
      if (swapIdx < 0 || swapIdx >= next.length) return prev
      ;[next[idx], next[swapIdx]] = [next[swapIdx], next[idx]]
      return next
    })
  }

  function updateWaypoint(id: string, field: keyof RouteWaypoint, value: string) {
    setWaypoints(prev =>
      prev.map(wp => wp.id === id ? { ...wp, [field]: value } : wp)
    )
  }

  // ── Styles ──

  const MODE_BTN = (active: boolean): React.CSSProperties => ({
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    fontSize: '10px',
    letterSpacing: '2px',
    color: active ? '#00ffff' : 'rgba(0,212,255,0.4)',
    padding: '3px 8px',
    fontFamily: 'Courier New, monospace',
    borderBottom: active ? '1px solid #00ffff' : '1px solid transparent',
    transition: 'color 0.15s',
  })

  const ACTION_BTN = (variant: 'primary' | 'danger' | 'accent' | 'dim' = 'primary'): React.CSSProperties => {
    const colors = {
      primary: { border: 'rgba(0,212,255,0.4)', color: '#00d4ff' },
      danger: { border: 'rgba(255,68,68,0.4)', color: '#ff4444' },
      accent: { border: '#00ffff', color: '#00ffff' },
      dim: { border: 'rgba(0,212,255,0.15)', color: 'rgba(0,212,255,0.4)' },
    }
    const c = colors[variant]
    return {
      background: 'none',
      border: `1px solid ${c.border}`,
      color: c.color,
      fontFamily: 'Courier New, monospace',
      fontSize: '10px',
      letterSpacing: '1.5px',
      padding: '3px 8px',
      cursor: 'pointer',
      textTransform: 'uppercase' as const,
      transition: 'background 0.1s',
    }
  }

  const isQuickPlacing = placing && placingRouteId === null
  const noTelemetry = !telemetry

  return (
    <ObserverGuard>
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        fontFamily: 'Courier New, monospace',
        overflow: 'hidden',
      }}
    >
      {/* Mode toggle */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(0,212,255,0.1)',
          flexShrink: 0,
        }}
      >
        <button style={MODE_BTN(mode === 'quick')} onClick={() => setMode('quick')}>
          QUICK INJECT
        </button>
        <button style={MODE_BTN(mode === 'route')} onClick={() => setMode('route')}>
          ROUTE BUILDER
        </button>
      </div>

      {/* Content area */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px' }}>

        {/* ── QUICK INJECT ── */}
        {mode === 'quick' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* Lat/Lon row */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>LAT</label>
                <input
                  type="number"
                  step="0.000001"
                  value={quick.lat}
                  onChange={e => setQuick(prev => ({ ...prev, lat: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="0.000000"
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>LON</label>
                <input
                  type="number"
                  step="0.000001"
                  value={quick.lon}
                  onChange={e => setQuick(prev => ({ ...prev, lon: e.target.value }))}
                  style={INPUT_STYLE}
                  placeholder="0.000000"
                />
              </div>
            </div>

            {/* Alt / Name / Objective row */}
            <div style={{ display: 'flex', gap: '6px' }}>
              <div style={{ width: '60px', flexShrink: 0 }}>
                <label style={LABEL_STYLE}>ALT (FT)</label>
                <input
                  type="number"
                  value={quick.altitude_ft}
                  onChange={e => setQuick(prev => ({ ...prev, altitude_ft: e.target.value }))}
                  style={INPUT_STYLE}
                />
              </div>
              <div style={{ flex: 1 }}>
                <label style={LABEL_STYLE}>NAME</label>
                <input
                  type="text"
                  value={quick.name}
                  maxLength={16}
                  onChange={e => setQuick(prev => ({ ...prev, name: e.target.value }))}
                  style={INPUT_STYLE}
                />
              </div>
            </div>

            {/* Objective type */}
            <div>
              <label style={LABEL_STYLE}>OBJECTIVE</label>
              <div style={{ display: 'flex', gap: '4px' }}>
                {OBJ_TYPES.map(ot => (
                  <button
                    key={ot}
                    onClick={() => setQuick(prev => ({ ...prev, objectiveType: ot }))}
                    style={{
                      ...ACTION_BTN(quick.objectiveType === ot ? 'accent' : 'dim'),
                      padding: '2px 6px',
                      fontSize: '11px',
                    }}
                  >
                    {ot}
                  </button>
                ))}
              </div>
            </div>

            {/* Briefing */}
            <div>
              <label style={LABEL_STYLE}>BRIEFING (OPTIONAL)</label>
              <textarea
                value={quick.briefing}
                onChange={e => setQuick(prev => ({ ...prev, briefing: e.target.value }))}
                rows={2}
                style={{
                  ...INPUT_STYLE,
                  resize: 'none',
                  lineHeight: '1.4',
                }}
                placeholder="Mission briefing text..."
              />
            </div>

            {/* Action buttons */}
            <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
              <button
                onClick={handleQuickPlaceToggle}
                disabled={noTelemetry}
                style={{
                  ...ACTION_BTN(isQuickPlacing ? 'accent' : 'primary'),
                  flex: 1,
                  animation: isQuickPlacing ? 'pulse 1s ease-in-out infinite' : undefined,
                  opacity: noTelemetry ? 0.4 : 1,
                  cursor: noTelemetry ? 'not-allowed' : 'pointer',
                }}
                title={noTelemetry ? 'No player telemetry' : undefined}
              >
                {isQuickPlacing ? 'CLICK TSD...' : 'PLACE ON MAP'}
              </button>
              <button
                onClick={handleQuickInject}
                style={{ ...ACTION_BTN('primary'), flex: 1 }}
              >
                INJECT
              </button>
            </div>
          </div>
        )}

        {/* ── ROUTE BUILDER ── */}
        {mode === 'route' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>

            {/* Waypoint list */}
            {waypoints.map((wp, idx) => {
              const isWpPlacing = placing && placingRouteId === wp.id
              return (
                <div
                  key={wp.id}
                  style={{
                    border: '1px solid rgba(0,212,255,0.1)',
                    padding: '4px 6px',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '4px',
                    background: isWpPlacing ? 'rgba(0,255,255,0.04)' : 'transparent',
                  }}
                >
                  {/* Header row */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '11px', color: 'rgba(0,212,255,0.5)', width: '14px' }}>
                      {idx + 1}
                    </span>
                    <input
                      type="text"
                      value={wp.name}
                      maxLength={12}
                      onChange={e => updateWaypoint(wp.id, 'name', e.target.value)}
                      style={{ ...INPUT_STYLE, flex: 1 }}
                      placeholder="WP name"
                    />
                    {/* Up/Down/Delete */}
                    <button
                      onClick={() => moveWaypoint(wp.id, 'up')}
                      disabled={idx === 0}
                      style={{ ...ACTION_BTN('dim'), padding: '1px 4px', fontSize: '11px', opacity: idx === 0 ? 0.3 : 1 }}
                    >
                      ↑
                    </button>
                    <button
                      onClick={() => moveWaypoint(wp.id, 'down')}
                      disabled={idx === waypoints.length - 1}
                      style={{ ...ACTION_BTN('dim'), padding: '1px 4px', fontSize: '11px', opacity: idx === waypoints.length - 1 ? 0.3 : 1 }}
                    >
                      ↓
                    </button>
                    <button
                      onClick={() => deleteWaypoint(wp.id)}
                      style={{ ...ACTION_BTN('danger'), padding: '1px 4px', fontSize: '9px' }}
                    >
                      ✕
                    </button>
                  </div>

                  {/* Lat/Lon/Alt row */}
                  <div style={{ display: 'flex', gap: '4px' }}>
                    <input
                      type="number"
                      step="0.000001"
                      value={wp.lat}
                      onChange={e => updateWaypoint(wp.id, 'lat', e.target.value)}
                      style={{ ...INPUT_STYLE, flex: 1 }}
                      placeholder="Lat"
                    />
                    <input
                      type="number"
                      step="0.000001"
                      value={wp.lon}
                      onChange={e => updateWaypoint(wp.id, 'lon', e.target.value)}
                      style={{ ...INPUT_STYLE, flex: 1 }}
                      placeholder="Lon"
                    />
                    <input
                      type="number"
                      value={wp.altitude_ft}
                      onChange={e => updateWaypoint(wp.id, 'altitude_ft', e.target.value)}
                      style={{ ...INPUT_STYLE, width: '50px', flex: 'none' }}
                      placeholder="Alt ft"
                    />
                  </div>

                  {/* Objective + Place button */}
                  <div style={{ display: 'flex', gap: '4px', alignItems: 'center' }}>
                    {OBJ_TYPES.map(ot => (
                      <button
                        key={ot}
                        onClick={() => updateWaypoint(wp.id, 'objectiveType', ot)}
                        style={{
                          ...ACTION_BTN(wp.objectiveType === ot ? 'accent' : 'dim'),
                          padding: '1px 5px',
                          fontSize: '11px',
                        }}
                      >
                        {ot.slice(0, 3)}
                      </button>
                    ))}
                    <div style={{ flex: 1 }} />
                    <button
                      onClick={() => handleRoutePlaceToggle(wp.id)}
                      disabled={noTelemetry}
                      style={{
                        ...ACTION_BTN(isWpPlacing ? 'accent' : 'dim'),
                        padding: '1px 6px',
                        fontSize: '11px',
                        opacity: noTelemetry ? 0.4 : 1,
                        cursor: noTelemetry ? 'not-allowed' : 'pointer',
                      }}
                      title={noTelemetry ? 'No player telemetry' : 'Click on TSD to place this waypoint'}
                    >
                      {isWpPlacing ? 'CLICK TSD...' : 'PLACE'}
                    </button>
                  </div>
                </div>
              )
            })}

            {/* Add waypoint button */}
            <button onClick={addWaypoint} style={{ ...ACTION_BTN('dim'), width: '100%' }}>
              + ADD WAYPOINT
            </button>

            {/* Briefing */}
            <div>
              <label style={LABEL_STYLE}>MISSION BRIEFING (OPTIONAL)</label>
              <textarea
                value={routeBriefing}
                onChange={e => setRouteBriefing(e.target.value)}
                rows={2}
                style={{ ...INPUT_STYLE, resize: 'none', lineHeight: '1.4' }}
                placeholder="Mission briefing text..."
              />
            </div>

            {/* Inject route */}
            <button onClick={handleRouteInject} style={{ ...ACTION_BTN('primary'), width: '100%' }}>
              INJECT ROUTE ({waypoints.filter(wp => wp.lat && wp.lon).length} WP)
            </button>
          </div>
        )}
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title="CONFIRM INJECTION"
        message={confirmMsg}
        confirmLabel="INJECT"
        onConfirm={() => {
          setConfirmOpen(false)
          if (pendingInject) {
            pendingInject()
            setPendingInject(null)
          }
        }}
        onCancel={() => {
          setConfirmOpen(false)
          setPendingInject(null)
        }}
      />
    </div>
    </ObserverGuard>
  )
}
