'use client'

import { useRef, useCallback } from 'react'
import type { PanelOffset } from '@/hooks/use-panel-positions'

interface DraggablePanelProps {
  panelId: string
  editMode: boolean
  offset: PanelOffset
  onUpdateOffset: (panelId: string, dx: number, dy: number) => void
  children: React.ReactNode
  className?: string
}

/**
 * Wraps any dashboard panel to make it draggable in edit mode.
 * Uses CSS transform: translate() to offset from grid position.
 * Drag handle is the entire panel surface.
 */
export function DraggablePanel({
  panelId,
  editMode,
  offset,
  onUpdateOffset,
  children,
  className = '',
}: DraggablePanelProps) {
  const dragRef = useRef<{
    startX: number
    startY: number
    origDx: number
    origDy: number
    moved: boolean
  } | null>(null)
  const elRef = useRef<HTMLDivElement>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editMode) return
      // Only start drag on left mouse button or touch
      if (e.button !== 0) return
      dragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        origDx: offset.dx,
        origDy: offset.dy,
        moved: false,
      }
      elRef.current?.setPointerCapture(e.pointerId)
    },
    [editMode, offset],
  )

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const state = dragRef.current
    if (!state) return
    const dx = state.origDx + (e.clientX - state.startX)
    const dy = state.origDy + (e.clientY - state.startY)
    if (Math.abs(e.clientX - state.startX) > 3 || Math.abs(e.clientY - state.startY) > 3) {
      state.moved = true
    }
    if (elRef.current) {
      elRef.current.style.transform = `translate(${dx}px, ${dy}px)`
    }
  }, [])

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      const state = dragRef.current
      if (!state) return
      const dx = state.origDx + (e.clientX - state.startX)
      const dy = state.origDy + (e.clientY - state.startY)
      dragRef.current = null
      if (state.moved) {
        onUpdateOffset(panelId, dx, dy)
        e.preventDefault() // Prevent click from firing after drag
      }
    },
    [panelId, onUpdateOffset],
  )

  return (
    <div
      ref={elRef}
      data-panel-id={panelId}
      className={`${editMode ? 'panel-edit-mode' : ''} ${className}`}
      style={{
        transform: `translate(${offset.dx}px, ${offset.dy}px)`,
        position: 'relative',
        zIndex: editMode ? 10 : undefined,
        touchAction: editMode ? 'none' : 'auto',
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {children}
    </div>
  )
}
