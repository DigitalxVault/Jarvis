'use client'

import { useState, useCallback } from 'react'
import { ObserverGuard } from './observer-guard'
import {
  CURATED_TEMPLATES,
  TEMPLATE_CATEGORIES,
  fillTemplate,
  getCustomTemplates,
  saveCustomTemplate,
  deleteCustomTemplate,
} from '@/lib/trainer-templates'
import type { TemplateCategory, TrainerTemplate } from '@/lib/trainer-templates'
import type { CommStage } from '@/hooks/use-trainer-comm'
import type { TelemetryPacket } from '@jarvis-dcs/shared'

interface TrainerTemplatesTabProps {
  stage: CommStage
  telemetry: TelemetryPacket | null
  onSendText: (text: string) => Promise<void>
}

const STAGE_LABELS: Partial<Record<CommStage, string>> = {
  rephrasing: 'REPHRASING...',
  speaking: 'SPEAKING',
  error: 'ERROR',
}

const EXTENDED_CATEGORIES = [...TEMPLATE_CATEGORIES, 'CUSTOM'] as const
type ExtendedCategory = TemplateCategory | 'CUSTOM'

export function TrainerTemplatesTab({ stage, telemetry, onSendText }: TrainerTemplatesTabProps) {
  const [activeCategory, setActiveCategory] = useState<ExtendedCategory>('SA')
  const [lastClickedId, setLastClickedId] = useState<string | null>(null)
  const [customTemplates, setCustomTemplates] = useState<TrainerTemplate[]>(() => getCustomTemplates())

  // Custom template form state
  const [showAddForm, setShowAddForm] = useState(false)
  const [newLabel, setNewLabel] = useState('')
  const [newTemplate, setNewTemplate] = useState('')
  const [newCategory, setNewCategory] = useState<TemplateCategory>('SA')

  const handleTemplateClick = useCallback(async (template: TrainerTemplate) => {
    if (stage !== 'idle') return
    setLastClickedId(template.id)
    const filled = fillTemplate(template.template, telemetry)
    await onSendText(filled)
    setLastClickedId(null)
  }, [stage, telemetry, onSendText])

  const handleSaveCustom = useCallback(() => {
    if (!newLabel.trim() || !newTemplate.trim()) return
    const saved = saveCustomTemplate({
      category: newCategory,
      label: newLabel.trim().toUpperCase(),
      template: newTemplate.trim(),
    })
    setCustomTemplates(prev => [...prev, saved])
    setNewLabel('')
    setNewTemplate('')
    setNewCategory('SA')
    setShowAddForm(false)
  }, [newLabel, newTemplate, newCategory])

  const handleDeleteCustom = useCallback((id: string) => {
    deleteCustomTemplate(id)
    setCustomTemplates(prev => prev.filter(t => t.id !== id))
  }, [])

  const visibleTemplates: TrainerTemplate[] =
    activeCategory === 'CUSTOM'
      ? customTemplates
      : CURATED_TEMPLATES.filter(t => t.category === activeCategory)

  const stageLabel = STAGE_LABELS[stage]
  const isPipelineRunning = stage !== 'idle' && stage !== 'error'

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
      {/* Category tabs */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
          flexShrink: 0,
          overflowX: 'auto',
        }}
      >
        {EXTENDED_CATEGORIES.map(cat => {
          // Hide CUSTOM tab if no custom templates and not currently adding
          if (cat === 'CUSTOM' && customTemplates.length === 0 && !showAddForm) {
            return (
              <button
                key={cat}
                onClick={() => { setActiveCategory(cat); setShowAddForm(true) }}
                style={{
                  fontSize: '8px',
                  letterSpacing: '2px',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  height: '22px',
                  padding: '0 8px',
                  color: 'rgba(0, 212, 255, 0.4)',
                  whiteSpace: 'nowrap',
                  flexShrink: 0,
                }}
              >
                + CUSTOM
              </button>
            )
          }
          return (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              style={{
                fontSize: '8px',
                letterSpacing: '2px',
                background: 'none',
                border: 'none',
                cursor: 'pointer',
                height: '22px',
                padding: '0 8px',
                color: activeCategory === cat ? '#00ffff' : 'rgba(0, 212, 255, 0.4)',
                borderBottom: activeCategory === cat ? '2px solid #00ffff' : '2px solid transparent',
                whiteSpace: 'nowrap',
                flexShrink: 0,
                transition: 'color 0.15s',
              }}
            >
              {cat}
            </button>
          )
        })}
      </div>

      {/* Template grid */}
      <div
        style={{
          flex: 1,
          overflowY: 'auto',
          padding: '6px',
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
        }}
      >
        {activeCategory === 'CUSTOM' && visibleTemplates.length === 0 && !showAddForm && (
          <div
            style={{
              fontSize: '8px',
              letterSpacing: '2px',
              color: 'rgba(0, 212, 255, 0.3)',
              textAlign: 'center',
              paddingTop: '8px',
            }}
          >
            NO CUSTOM TEMPLATES
          </div>
        )}

        {/* Template buttons grid */}
        {visibleTemplates.length > 0 && (
          <div
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: '4px',
            }}
          >
            {visibleTemplates.map(template => {
              const isActive = lastClickedId === template.id && isPipelineRunning
              return (
                <div key={template.id} style={{ display: 'flex', alignItems: 'stretch' }}>
                  <button
                    onClick={() => { void handleTemplateClick(template) }}
                    disabled={stage !== 'idle'}
                    style={{
                      fontSize: '8px',
                      letterSpacing: '1px',
                      fontFamily: 'Courier New, monospace',
                      background: isActive
                        ? 'rgba(0, 255, 255, 0.08)'
                        : 'rgba(0, 13, 26, 0.8)',
                      border: isActive
                        ? '1px solid rgba(0, 255, 255, 0.6)'
                        : '1px solid rgba(0, 212, 255, 0.25)',
                      color: '#00d4ff',
                      cursor: stage === 'idle' ? 'pointer' : 'not-allowed',
                      padding: '4px 6px',
                      minWidth: '80px',
                      maxWidth: '130px',
                      textAlign: 'left',
                      lineHeight: '1.3',
                      transition: 'border-color 0.15s, background 0.15s',
                      opacity: stage !== 'idle' && lastClickedId !== template.id ? 0.5 : 1,
                      animation: isActive ? 'pulse 1s ease-in-out infinite' : 'none',
                    }}
                    onMouseEnter={e => {
                      if (stage === 'idle') {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0, 255, 255, 0.7)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 255, 255, 0.05)'
                      }
                    }}
                    onMouseLeave={e => {
                      if (!isActive) {
                        (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(0, 212, 255, 0.25)'
                        ;(e.currentTarget as HTMLButtonElement).style.background = 'rgba(0, 13, 26, 0.8)'
                      }
                    }}
                  >
                    {template.label}
                  </button>
                  {template.isCustom && (
                    <button
                      onClick={() => handleDeleteCustom(template.id)}
                      style={{
                        fontSize: '8px',
                        background: 'none',
                        border: '1px solid rgba(255, 68, 68, 0.2)',
                        borderLeft: 'none',
                        color: 'rgba(255, 68, 68, 0.5)',
                        cursor: 'pointer',
                        padding: '0 4px',
                        lineHeight: '1',
                        fontFamily: 'Courier New, monospace',
                      }}
                      title="Delete custom template"
                    >
                      x
                    </button>
                  )}
                </div>
              )
            })}
          </div>
        )}

        {/* Custom template add form */}
        {activeCategory === 'CUSTOM' && showAddForm && (
          <div
            style={{
              border: '1px solid rgba(0, 212, 255, 0.2)',
              padding: '6px',
              display: 'flex',
              flexDirection: 'column',
              gap: '4px',
              background: 'rgba(0, 13, 26, 0.6)',
            }}
          >
            <div style={{ fontSize: '8px', letterSpacing: '2px', color: 'rgba(0, 212, 255, 0.6)' }}>
              NEW TEMPLATE
            </div>

            <select
              value={newCategory}
              onChange={e => setNewCategory(e.target.value as TemplateCategory)}
              style={{
                fontSize: '8px',
                letterSpacing: '1px',
                fontFamily: 'Courier New, monospace',
                background: 'rgba(0, 13, 26, 0.9)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00d4ff',
                padding: '3px 4px',
                cursor: 'pointer',
              }}
            >
              {TEMPLATE_CATEGORIES.map(cat => (
                <option key={cat} value={cat}>{cat}</option>
              ))}
            </select>

            <input
              type="text"
              placeholder="BUTTON LABEL (max 30)"
              maxLength={30}
              value={newLabel}
              onChange={e => setNewLabel(e.target.value)}
              style={{
                fontSize: '8px',
                letterSpacing: '1px',
                fontFamily: 'Courier New, monospace',
                background: 'rgba(0, 13, 26, 0.9)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00d4ff',
                padding: '3px 4px',
                outline: 'none',
              }}
            />

            <textarea
              placeholder="Template text... use {ALT}, {SPEED}, {HEADING}, {FUEL}, {MACH}, {G}"
              maxLength={200}
              value={newTemplate}
              onChange={e => setNewTemplate(e.target.value)}
              rows={2}
              style={{
                fontSize: '8px',
                letterSpacing: '1px',
                fontFamily: 'Courier New, monospace',
                background: 'rgba(0, 13, 26, 0.9)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                color: '#00d4ff',
                padding: '3px 4px',
                outline: 'none',
                resize: 'none',
              }}
            />

            <div style={{ display: 'flex', gap: '4px' }}>
              <button
                onClick={handleSaveCustom}
                disabled={!newLabel.trim() || !newTemplate.trim()}
                style={{
                  fontSize: '8px',
                  letterSpacing: '2px',
                  fontFamily: 'Courier New, monospace',
                  background: newLabel.trim() && newTemplate.trim()
                    ? 'rgba(0, 255, 136, 0.1)'
                    : 'rgba(0, 13, 26, 0.8)',
                  border: '1px solid rgba(0, 255, 136, 0.3)',
                  color: '#00ff88',
                  cursor: newLabel.trim() && newTemplate.trim() ? 'pointer' : 'not-allowed',
                  padding: '3px 8px',
                  opacity: newLabel.trim() && newTemplate.trim() ? 1 : 0.4,
                }}
              >
                SAVE
              </button>
              <button
                onClick={() => { setShowAddForm(false); setNewLabel(''); setNewTemplate('') }}
                style={{
                  fontSize: '8px',
                  letterSpacing: '2px',
                  fontFamily: 'Courier New, monospace',
                  background: 'none',
                  border: '1px solid rgba(255, 68, 68, 0.3)',
                  color: 'rgba(255, 68, 68, 0.7)',
                  cursor: 'pointer',
                  padding: '3px 8px',
                }}
              >
                CANCEL
              </button>
            </div>
          </div>
        )}

        {/* Add new button for CUSTOM tab (when not showing form) */}
        {activeCategory === 'CUSTOM' && !showAddForm && (
          <button
            onClick={() => setShowAddForm(true)}
            style={{
              fontSize: '8px',
              letterSpacing: '2px',
              fontFamily: 'Courier New, monospace',
              background: 'none',
              border: '1px dashed rgba(0, 212, 255, 0.3)',
              color: 'rgba(0, 212, 255, 0.5)',
              cursor: 'pointer',
              padding: '4px 8px',
              alignSelf: 'flex-start',
            }}
          >
            + ADD TEMPLATE
          </button>
        )}
      </div>

      {/* Stage progress */}
      {stageLabel && (
        <div
          style={{
            borderTop: '1px solid rgba(0, 212, 255, 0.15)',
            padding: '3px 6px',
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
          }}
        >
          <div
            style={{
              width: '5px',
              height: '5px',
              borderRadius: '50%',
              background: stage === 'error' ? '#ff4444' : '#00ffff',
              animation: isPipelineRunning ? 'pulse 1s ease-in-out infinite' : 'none',
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: '8px',
              letterSpacing: '2px',
              color: stage === 'error' ? '#ff4444' : '#00ffff',
            }}
          >
            {stageLabel}
          </span>
        </div>
      )}
    </div>
    </ObserverGuard>
  )
}
