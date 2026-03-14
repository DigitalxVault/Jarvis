'use client'

import { useState, useEffect, useCallback } from 'react'

interface CollapsibleWidgetProps {
  panelId: string
  title: string
  children: React.ReactNode
  className?: string
}

export function CollapsibleWidget({ panelId, title, children, className = '' }: CollapsibleWidgetProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  useEffect(() => {
    const stored = localStorage.getItem(`jarvis.panel.${panelId}`)
    if (stored === 'collapsed') {
      setIsExpanded(false)
    }
  }, [panelId])

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
        className="w-full flex items-center gap-2 px-2.5 py-1.5 collapsible-title cursor-pointer select-none text-[14px] tracking-[3px] opacity-50 uppercase transition-colors"
      >
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
