'use client'

import { useRef, useState, useEffect, useCallback } from 'react'
import type { LogEntry } from '@/hooks/use-trainer-log'

type LogTab = 'events' | 'conversation' | 'all'

interface TrainerLogPanelProps {
  entries: LogEntry[]
}

function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString('en-US', {
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  })
}

function entryColorClass(entry: LogEntry): string {
  switch (entry.type) {
    case 'phase':
      return 'text-jarvis-success'
    case 'alert':
      if (entry.severity === 'critical') return 'text-jarvis-danger'
      if (entry.severity === 'warning') return 'text-jarvis-warning'
      return 'text-jarvis-primary'
    case 'tactical':
      return entry.severity === 'warning' ? 'text-jarvis-warning' : 'text-jarvis-accent'
    case 'connection':
      return 'text-jarvis-accent/70'
    case 'conversation-player':
      return 'text-jarvis-primary'
    case 'conversation-jarvis':
      return 'text-jarvis-accent'
    default:
      return 'text-jarvis-primary/60'
  }
}

function entryPrefix(entry: LogEntry): string {
  switch (entry.type) {
    case 'conversation-player':
      return 'PILOT: '
    case 'conversation-jarvis':
      return 'JARVIS: '
    default:
      return ''
  }
}

function filterEntries(entries: LogEntry[], tab: LogTab): LogEntry[] {
  switch (tab) {
    case 'events':
      return entries.filter(e =>
        e.type === 'phase' || e.type === 'alert' || e.type === 'connection' || e.type === 'tactical'
      )
    case 'conversation':
      return entries.filter(e =>
        e.type === 'conversation-player' || e.type === 'conversation-jarvis'
      )
    case 'all':
    default:
      return entries
  }
}

export function TrainerLogPanel({ entries }: TrainerLogPanelProps) {
  const [activeTab, setActiveTab] = useState<LogTab>('all')
  const containerRef = useRef<HTMLDivElement>(null)
  const isAtBottomRef = useRef(true)

  const filtered = filterEntries(entries, activeTab)

  const handleScroll = useCallback(() => {
    const el = containerRef.current
    if (!el) return
    isAtBottomRef.current = el.scrollHeight - el.scrollTop - el.clientHeight < 50
  }, [])

  // Auto-scroll to bottom when new entries arrive, if already at bottom
  useEffect(() => {
    if (!isAtBottomRef.current) return
    const el = containerRef.current
    if (el) {
      el.scrollTop = el.scrollHeight
    }
  }, [filtered])

  const tabStyle = (tab: LogTab) => ({
    fontSize: '14px' as const,
    letterSpacing: '2px' as const,
    padding: '3px 8px' as const,
    cursor: 'pointer' as const,
    borderBottom: activeTab === tab ? '1px solid var(--color-jarvis-accent)' : '1px solid transparent',
    color: activeTab === tab ? 'var(--color-jarvis-accent)' : 'rgba(0, 212, 255, 0.4)',
    background: 'none',
    fontFamily: 'Courier New, monospace',
  })

  return (
    <div
      className="jarvis-panel flex flex-col h-full"
      style={{ padding: '8px', minHeight: 0 }}
    >
      {/* Panel title */}
      <div
        className="text-jarvis-accent/70 shrink-0 mb-2"
        style={{ fontSize: '14px', letterSpacing: '4px' }}
      >
        MISSION LOG
      </div>

      {/* Tab bar */}
      <div className="flex shrink-0 mb-2 border-b border-jarvis-primary/10">
        <button style={tabStyle('events')} onClick={() => setActiveTab('events')}>
          EVENTS
        </button>
        <button style={tabStyle('conversation')} onClick={() => setActiveTab('conversation')}>
          COMMS
        </button>
        <button style={tabStyle('all')} onClick={() => setActiveTab('all')}>
          ALL
        </button>
      </div>

      {/* Log entries */}
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto min-h-0"
        style={{ scrollbarWidth: 'none' as const }}
      >
        {filtered.length === 0 ? (
          <div
            className="text-jarvis-accent flex items-center justify-center h-full"
            style={{ fontSize: '14px', letterSpacing: '2px', opacity: 0.3 }}
          >
            NO EVENTS YET
          </div>
        ) : (
          <div className="flex flex-col gap-0.5">
            {filtered.map(entry => (
              <div
                key={entry.id}
                className={`leading-relaxed ${entryColorClass(entry)}`}
                style={{
                  fontSize: '14px',
                  fontFamily: 'Courier New, monospace',
                  wordBreak: 'break-word',
                }}
              >
                <span className="opacity-50">[{formatTime(entry.ts)}] </span>
                <span className="opacity-70">{entryPrefix(entry)}</span>
                <span>{entry.label}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
