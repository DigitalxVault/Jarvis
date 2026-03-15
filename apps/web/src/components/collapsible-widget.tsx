'use client'

import { useState, useCallback } from 'react'

interface CollapsibleWidgetProps {
  panelId: string
  title: string
  children: React.ReactNode
  className?: string
  editMode?: boolean
  dragHandlers?: {
    onPointerDown: (e: React.PointerEvent) => void
    onPointerMove: (e: React.PointerEvent) => void
    onPointerUp: (e: React.PointerEvent) => void
  }
}

export function CollapsibleWidget({ panelId, title, children, className = '', editMode = false, dragHandlers }: CollapsibleWidgetProps) {
  const [isExpanded, setIsExpanded] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true
    return localStorage.getItem(`jarvis.panel.${panelId}`) !== 'collapsed'
  })

  const toggle = useCallback(() => {
    setIsExpanded((prev) => {
      const next = !prev
      localStorage.setItem(`jarvis.panel.${panelId}`, next ? 'expanded' : 'collapsed')
      return next
    })
  }, [panelId])

  return (
    <div className={`jarvis-panel p-0 ${className}`}>
      <button
        onClick={toggle}
        aria-expanded={isExpanded}
        className={`w-full flex items-center gap-2 px-2.5 py-1.5 collapsible-title select-none text-[14px] tracking-[3px] opacity-50 uppercase transition-colors min-h-[44px] sm:min-h-0 ${
          editMode ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'
        }`}
        {...(editMode && dragHandlers ? {
          onPointerDown: dragHandlers.onPointerDown,
          onPointerMove: dragHandlers.onPointerMove,
          onPointerUp: dragHandlers.onPointerUp,
        } : {})}
      >
        {editMode && (
          <span className="opacity-40 text-[16px] mr-1">⠿</span>
        )}
        <span
          className="transition-transform duration-150 inline-block"
          style={{ transform: isExpanded ? 'rotate(90deg)' : 'rotate(0deg)' }}
        >
          ▸
        </span>
        {title}
      </button>

      <div
        className="grid transition-[grid-template-rows] duration-150 ease-out"
        style={{ gridTemplateRows: isExpanded ? '1fr' : '0fr' }}
      >
        <div className="overflow-hidden">
          <div className="px-2.5 pb-2.5">
            {children}
          </div>
        </div>
      </div>
    </div>
  )
}
