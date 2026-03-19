'use client'

import { useState } from 'react'
import { useDcsCommands } from '@/hooks/use-dcs-commands'
import { useToast } from '@/components/toast-notification'
import { ConfirmModal } from '@/components/confirm-modal'
import { ObserverGuard } from './observer-guard'
import type {
  TelemetryPacket,
  DcsSkillLevel,
  DcsAiTask,
  UnitCategory,
  CardinalDirection,
  SpawnUnitPayload,
  SetAiTaskPayload,
  AbsolutePosition,
} from '@jarvis-dcs/shared'

interface TrainerControlsTabProps {
  sessionId: string
  telemetry: TelemetryPacket | null
}

// ---------------------------------------------------------------------------
// Presets
// ---------------------------------------------------------------------------

interface SpawnPreset {
  label: string
  unitType: string
  category: UnitCategory
  count: number
  skill: DcsSkillLevel
  task: DcsAiTask
  /** Relative to player: bearing (deg), range (nm), altitude (ft) */
  bra: { bearing: number; range: number; alt: number }
}

const SPAWN_PRESETS: SpawnPreset[] = [
  {
    label: '2x MiG-29 BVR',
    unitType: 'MiG-29A',
    category: 'fighter',
    count: 2,
    skill: 'High',
    task: 'CAP',
    bra: { bearing: 0, range: 30, alt: 25000 },
  },
  {
    label: '4x Su-25 CAS',
    unitType: 'Su-25',
    category: 'bomber',
    count: 4,
    skill: 'Good',
    task: 'CAS',
    bra: { bearing: 180, range: 15, alt: 8000 },
  },
  {
    label: '2x F-14 CAP',
    unitType: 'F-14B',
    category: 'fighter',
    count: 2,
    skill: 'Excellent',
    task: 'CAP',
    bra: { bearing: 90, range: 20, alt: 30000 },
  },
  {
    label: 'SA-11 Buk SAM',
    unitType: 'SA-11',
    category: 'sam',
    count: 1,
    skill: 'High',
    task: 'Nothing',
    bra: { bearing: 45, range: 10, alt: 100 },
  },
]

const CARDINAL_BEARINGS: Record<CardinalDirection, number> = {
  N: 0, NE: 45, E: 90, SE: 135, S: 180, SW: 225, W: 270, NW: 315,
}

// ---------------------------------------------------------------------------
// Position conversion: BRA relative to player → absolute lat/lon
// ---------------------------------------------------------------------------

function braToAbsolute(
  playerLat: number,
  playerLon: number,
  bearingDeg: number,
  rangeNm: number,
  altFt: number
): AbsolutePosition {
  const bearingRad = bearingDeg * (Math.PI / 180)
  const distKm = rangeNm * 1.852
  const lat2 = playerLat + (distKm / 111.32) * Math.cos(bearingRad)
  const lon2 =
    playerLon +
    (distKm / (111.32 * Math.cos(playerLat * (Math.PI / 180)))) * Math.sin(bearingRad)
  return { mode: 'absolute', lat: lat2, lon: lon2, altitude_ft: altFt }
}

// ---------------------------------------------------------------------------
// Shared input style
// ---------------------------------------------------------------------------

const INPUT_STYLE: React.CSSProperties = {
  background: 'transparent',
  border: '1px solid rgba(0, 212, 255, 0.3)',
  color: '#00d4ff',
  fontFamily: 'Courier New, monospace',
  fontSize: '14px',
  letterSpacing: '1px',
  padding: '4px 6px',
  outline: 'none',
  width: '100%',
}

const LABEL_STYLE: React.CSSProperties = {
  fontSize: '14px',
  letterSpacing: '2px',
  color: 'rgba(0, 212, 255, 0.5)',
  textTransform: 'uppercase',
  marginBottom: '2px',
}

const RADIO_OPTION_STYLE = (active: boolean): React.CSSProperties => ({
  fontSize: '14px',
  letterSpacing: '1px',
  color: active ? '#00ffff' : 'rgba(0, 212, 255, 0.4)',
  cursor: 'pointer',
  textTransform: 'uppercase',
  border: `1px solid ${active ? 'rgba(0,255,255,0.4)' : 'rgba(0,212,255,0.15)'}`,
  padding: '2px 6px',
  background: active ? 'rgba(0,255,255,0.06)' : 'transparent',
})

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function TrainerControlsTab({ sessionId, telemetry }: TrainerControlsTabProps) {
  const { sendCommand } = useDcsCommands(sessionId)
  const { showToast } = useToast()

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = useState(false)
  const [confirmTitle, setConfirmTitle] = useState('')
  const [confirmMsg, setConfirmMsg] = useState('')
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null)
  const [sending, setSending] = useState(false)

  // ----- Custom form state -----
  const [category, setCategory] = useState<UnitCategory>('fighter')
  const [unitType, setUnitType] = useState('MiG-29A')
  const [count, setCount] = useState(2)
  const [skill, setSkill] = useState<DcsSkillLevel>('High')
  const [task, setTask] = useState<DcsAiTask>('CAP')
  const [posMode, setPosMode] = useState<'simple' | 'bra' | 'absolute'>('bra')

  // Simple position
  const [simpleDir, setSimpleDir] = useState<CardinalDirection>('N')
  const [simpleDist, setSimpleDist] = useState(20)
  const [simpleAlt, setSimpleAlt] = useState(20000)

  // BRA position
  const [braBearing, setBraBearing] = useState(0)
  const [braRange, setBraRange] = useState(20)
  const [braAlt, setBraAlt] = useState(20000)

  // Absolute position
  const [absLat, setAbsLat] = useState(0)
  const [absLon, setAbsLon] = useState(0)
  const [absAlt, setAbsAlt] = useState(20000)

  // Set AI task section
  const [aiSectionOpen, setAiSectionOpen] = useState(false)
  const [aiGroupName, setAiGroupName] = useState('')
  const [aiTask, setAiTask] = useState<DcsAiTask>('CAP')
  const [aiSending, setAiSending] = useState(false)

  const hasPlayerPos = telemetry !== null

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  function resolvePosition(): AbsolutePosition | null {
    if (posMode === 'absolute') {
      return { mode: 'absolute', lat: absLat, lon: absLon, altitude_ft: absAlt }
    }
    if (!telemetry) return null
    const playerLat = telemetry.pos.lat
    const playerLon = telemetry.pos.lon
    if (posMode === 'simple') {
      const bearing = CARDINAL_BEARINGS[simpleDir]
      return braToAbsolute(playerLat, playerLon, bearing, simpleDist, simpleAlt)
    }
    // bra
    return braToAbsolute(playerLat, playerLon, braBearing, braRange, braAlt)
  }

  function openConfirm(title: string, msg: string, action: () => Promise<void>) {
    setConfirmTitle(title)
    setConfirmMsg(msg)
    setPendingAction(() => action)
    setConfirmOpen(true)
  }

  async function executeConfirmed() {
    if (!pendingAction) return
    setConfirmOpen(false)
    setSending(true)
    try {
      await pendingAction()
    } finally {
      setSending(false)
      setPendingAction(null)
    }
  }

  // ---------------------------------------------------------------------------
  // Preset handler
  // ---------------------------------------------------------------------------

  function handlePreset(preset: SpawnPreset) {
    const action = async () => {
      let pos: AbsolutePosition
      if (telemetry) {
        pos = braToAbsolute(
          telemetry.pos.lat,
          telemetry.pos.lon,
          preset.bra.bearing,
          preset.bra.range,
          preset.bra.alt,
        )
      } else {
        pos = { mode: 'absolute', lat: 0, lon: 0, altitude_ft: preset.bra.alt }
      }

      const payload: SpawnUnitPayload = {
        unitType: preset.unitType,
        category: preset.category,
        count: preset.count,
        skill: preset.skill,
        task: preset.task,
        position: pos,
      }

      try {
        const result = await sendCommand('spawn_unit', payload)
        showToast(result.message, result.success ? 'success' : 'error')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Command failed', 'error')
      }
    }

    const altLabel = preset.bra.alt >= 10000
      ? `${Math.round(preset.bra.alt / 1000)}K`
      : `${preset.bra.alt}`
    const posLabel = telemetry
      ? `BRA ${preset.bra.bearing}°/${preset.bra.range}NM/${altLabel}FT`
      : `NO PLAYER POS`

    openConfirm(
      'CONFIRM SPAWN',
      `SPAWN ${preset.count}x ${preset.unitType} — ${posLabel}`,
      action
    )
  }

  // ---------------------------------------------------------------------------
  // Custom spawn handler
  // ---------------------------------------------------------------------------

  function handleCustomSpawn() {
    const pos = resolvePosition()
    if (!pos) {
      showToast('AWAITING PLAYER POSITION', 'error')
      return
    }

    const action = async () => {
      const payload: SpawnUnitPayload = {
        unitType,
        category,
        count,
        skill,
        task,
        position: pos,
      }
      try {
        const result = await sendCommand('spawn_unit', payload)
        showToast(result.message, result.success ? 'success' : 'error')
      } catch (err) {
        showToast(err instanceof Error ? err.message : 'Command failed', 'error')
      }
    }

    const altFt = posMode === 'absolute' ? absAlt : posMode === 'bra' ? braAlt : simpleAlt
    const altLabel = altFt >= 10000 ? `${Math.round(altFt / 1000)}K` : `${altFt}`

    openConfirm(
      'CONFIRM SPAWN',
      `SPAWN ${count}x ${unitType} — ${skill} — ${task} — ${altLabel}FT`,
      action
    )
  }

  // ---------------------------------------------------------------------------
  // Set AI task handler
  // ---------------------------------------------------------------------------

  async function handleSetAiTask() {
    if (!aiGroupName.trim()) {
      showToast('GROUP NAME REQUIRED', 'error')
      return
    }
    setAiSending(true)
    try {
      const payload: SetAiTaskPayload = { groupName: aiGroupName.trim(), task: aiTask }
      const result = await sendCommand('set_ai_task', payload)
      showToast(result.message, result.success ? 'success' : 'error')
    } catch (err) {
      showToast(err instanceof Error ? err.message : 'Command failed', 'error')
    } finally {
      setAiSending(false)
    }
  }

  // ---------------------------------------------------------------------------
  // Render helpers
  // ---------------------------------------------------------------------------

  function RadioGroup<T extends string>({
    options,
    value,
    onChange,
  }: {
    options: T[]
    value: T
    onChange: (v: T) => void
  }) {
    return (
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '3px' }}>
        {options.map(opt => (
          <button
            key={opt}
            onClick={() => onChange(opt)}
            style={RADIO_OPTION_STYLE(value === opt)}
          >
            {opt}
          </button>
        ))}
      </div>
    )
  }

  // ---------------------------------------------------------------------------
  // Render
  // ---------------------------------------------------------------------------

  return (
    <ObserverGuard>
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
        fontFamily: 'Courier New, monospace',
      }}
    >
      {/* Scrollable content */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: '8px' }}>

        {/* ---- PRESETS ---- */}
        <div>
          <div style={LABEL_STYLE}>SPAWN PRESETS</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '4px' }}>
            {SPAWN_PRESETS.map(preset => (
              <button
                key={preset.label}
                onClick={() => handlePreset(preset)}
                disabled={sending}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 212, 255, 0.2)',
                  color: 'rgba(0, 212, 255, 0.6)',
                  fontFamily: 'Courier New, monospace',
                  fontSize: '14px',
                  letterSpacing: '1px',
                  textTransform: 'uppercase',
                  padding: '5px 4px',
                  cursor: sending ? 'not-allowed' : 'pointer',
                  textAlign: 'left',
                  transition: 'color 0.15s, border-color 0.15s',
                }}
                onMouseEnter={e => {
                  if (!sending) {
                    e.currentTarget.style.color = '#00ffff'
                    e.currentTarget.style.borderColor = 'rgba(0,255,255,0.4)'
                  }
                }}
                onMouseLeave={e => {
                  e.currentTarget.style.color = 'rgba(0, 212, 255, 0.6)'
                  e.currentTarget.style.borderColor = 'rgba(0, 212, 255, 0.2)'
                }}
              >
                {preset.label}
              </button>
            ))}
          </div>
        </div>

        {/* ---- CUSTOM FORM ---- */}
        <div style={{ borderTop: '1px solid rgba(0,212,255,0.1)', paddingTop: '6px' }}>
          <div style={LABEL_STYLE}>CUSTOM SPAWN</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '5px' }}>

            {/* Category */}
            <div>
              <div style={LABEL_STYLE}>CATEGORY</div>
              <RadioGroup<UnitCategory>
                options={['fighter', 'bomber', 'sam', 'ground']}
                value={category}
                onChange={setCategory}
              />
            </div>

            {/* Unit Type */}
            <div>
              <div style={LABEL_STYLE}>UNIT TYPE</div>
              <input
                type="text"
                value={unitType}
                onChange={e => setUnitType(e.target.value)}
                style={INPUT_STYLE}
                placeholder="e.g. MiG-29A"
              />
            </div>

            {/* Count */}
            <div>
              <div style={LABEL_STYLE}>COUNT</div>
              <div style={{ display: 'flex', gap: '3px', alignItems: 'center' }}>
                {[1, 2, 4].map(n => (
                  <button
                    key={n}
                    onClick={() => setCount(n)}
                    style={RADIO_OPTION_STYLE(count === n)}
                  >
                    {n}
                  </button>
                ))}
                <input
                  type="number"
                  min="1"
                  max="16"
                  value={count}
                  onChange={e => setCount(Math.max(1, parseInt(e.target.value) || 1))}
                  style={{ ...INPUT_STYLE, width: '48px' }}
                />
              </div>
            </div>

            {/* Skill */}
            <div>
              <div style={LABEL_STYLE}>SKILL</div>
              <RadioGroup<DcsSkillLevel>
                options={['Average', 'Good', 'High', 'Excellent']}
                value={skill}
                onChange={setSkill}
              />
            </div>

            {/* Task */}
            <div>
              <div style={LABEL_STYLE}>TASK</div>
              <RadioGroup<DcsAiTask>
                options={['CAP', 'Fighter Sweep', 'CAS', 'Orbit', 'Nothing']}
                value={task}
                onChange={setTask}
              />
            </div>

            {/* Position Mode */}
            <div>
              <div style={LABEL_STYLE}>POSITION MODE</div>
              <RadioGroup<'simple' | 'bra' | 'absolute'>
                options={['simple', 'bra', 'absolute']}
                value={posMode}
                onChange={setPosMode}
              />

              {!hasPlayerPos && posMode !== 'absolute' && (
                <div
                  style={{
                    fontSize: '14px',
                    letterSpacing: '1px',
                    color: 'rgba(255, 68, 68, 0.7)',
                    marginTop: '3px',
                    textTransform: 'uppercase',
                  }}
                >
                  AWAITING PLAYER POSITION
                </div>
              )}

              {/* Simple fields */}
              {posMode === 'simple' && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>DIR</div>
                    <select
                      value={simpleDir}
                      onChange={e => setSimpleDir(e.target.value as CardinalDirection)}
                      style={{ ...INPUT_STYLE, appearance: 'none' }}
                    >
                      {(Object.keys(CARDINAL_BEARINGS) as CardinalDirection[]).map(d => (
                        <option key={d} value={d}>{d}</option>
                      ))}
                    </select>
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>DIST (NM)</div>
                    <input
                      type="number"
                      min="1"
                      value={simpleDist}
                      onChange={e => setSimpleDist(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>ALT (FT)</div>
                    <input
                      type="number"
                      step="1000"
                      value={simpleAlt}
                      onChange={e => setSimpleAlt(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}

              {/* BRA fields */}
              {posMode === 'bra' && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>BRG (°)</div>
                    <input
                      type="number"
                      min="0"
                      max="360"
                      value={braBearing}
                      onChange={e => setBraBearing(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>RNG (NM)</div>
                    <input
                      type="number"
                      min="1"
                      value={braRange}
                      onChange={e => setBraRange(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>ALT (FT)</div>
                    <input
                      type="number"
                      step="1000"
                      value={braAlt}
                      onChange={e => setBraAlt(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}

              {/* Absolute fields */}
              {posMode === 'absolute' && (
                <div style={{ display: 'flex', gap: '4px', marginTop: '4px', alignItems: 'flex-end' }}>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>LAT</div>
                    <input
                      type="number"
                      step="0.01"
                      value={absLat}
                      onChange={e => setAbsLat(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>LON</div>
                    <input
                      type="number"
                      step="0.01"
                      value={absLon}
                      onChange={e => setAbsLon(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                  <div style={{ flex: 1 }}>
                    <div style={LABEL_STYLE}>ALT (FT)</div>
                    <input
                      type="number"
                      step="1000"
                      value={absAlt}
                      onChange={e => setAbsAlt(parseFloat(e.target.value) || 0)}
                      style={INPUT_STYLE}
                    />
                  </div>
                </div>
              )}
            </div>

            {/* SPAWN button */}
            <button
              onClick={handleCustomSpawn}
              disabled={sending}
              style={{
                background: 'transparent',
                border: '1px solid rgba(0, 255, 255, 0.4)',
                color: '#00ffff',
                fontFamily: 'Courier New, monospace',
                fontSize: '14px',
                letterSpacing: '2px',
                textTransform: 'uppercase',
                padding: '5px',
                cursor: sending ? 'not-allowed' : 'pointer',
                opacity: sending ? 0.5 : 1,
                alignSelf: 'flex-start',
                minWidth: '80px',
              }}
            >
              {sending ? 'SENDING...' : 'SPAWN'}
            </button>
          </div>
        </div>

        {/* ---- SET AI OBJECTIVE ---- */}
        <div style={{ borderTop: '1px solid rgba(0,212,255,0.1)', paddingTop: '6px' }}>
          <button
            onClick={() => setAiSectionOpen(prev => !prev)}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              padding: 0,
              width: '100%',
            }}
          >
            <span
              style={{
                fontSize: '14px',
                letterSpacing: '2px',
                color: 'rgba(0, 212, 255, 0.4)',
                textTransform: 'uppercase',
              }}
            >
              SET AI OBJECTIVE
            </span>
            <span
              style={{
                fontSize: '9px',
                color: 'rgba(0, 212, 255, 0.3)',
                transform: aiSectionOpen ? 'rotate(90deg)' : 'none',
                transition: 'transform 0.15s',
                display: 'inline-block',
              }}
            >
              ▶
            </span>
          </button>

          {aiSectionOpen && (
            <div style={{ marginTop: '6px', display: 'flex', flexDirection: 'column', gap: '5px' }}>
              <div>
                <div style={LABEL_STYLE}>GROUP NAME</div>
                <input
                  type="text"
                  value={aiGroupName}
                  onChange={e => setAiGroupName(e.target.value)}
                  placeholder="JARVIS-XXXXXX"
                  style={INPUT_STYLE}
                />
              </div>

              <div>
                <div style={LABEL_STYLE}>TASK</div>
                <RadioGroup<DcsAiTask>
                  options={['CAP', 'Fighter Sweep', 'CAS', 'Orbit', 'Nothing']}
                  value={aiTask}
                  onChange={setAiTask}
                />
              </div>

              <button
                onClick={handleSetAiTask}
                disabled={aiSending}
                style={{
                  background: 'transparent',
                  border: '1px solid rgba(0, 212, 255, 0.3)',
                  color: '#00d4ff',
                  fontFamily: 'Courier New, monospace',
                  fontSize: '9px',
                  letterSpacing: '2px',
                  textTransform: 'uppercase',
                  padding: '5px',
                  cursor: aiSending ? 'not-allowed' : 'pointer',
                  opacity: aiSending ? 0.5 : 1,
                  alignSelf: 'flex-start',
                  minWidth: '60px',
                }}
              >
                {aiSending ? 'SENDING...' : 'SEND'}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Confirm modal */}
      <ConfirmModal
        open={confirmOpen}
        title={confirmTitle}
        message={confirmMsg}
        onConfirm={executeConfirmed}
        onCancel={() => setConfirmOpen(false)}
      />
    </div>
    </ObserverGuard>
  )
}
