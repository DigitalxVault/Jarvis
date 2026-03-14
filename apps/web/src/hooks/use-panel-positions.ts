'use client'

import { useState, useCallback, useRef } from 'react'

const STORAGE_KEY = 'jarvis-panel-positions-v1'

export interface PanelOffset {
  dx: number
  dy: number
}

type PositionMap = Record<string, PanelOffset>

function loadPositions(): PositionMap {
  if (typeof window === 'undefined') return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    return raw ? JSON.parse(raw) : {}
  } catch {
    return {}
  }
}

function savePositions(positions: PositionMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(positions))
  } catch {
    // Private browsing — silently ignore
  }
}

export function usePanelPositions() {
  const [positions, setPositions] = useState<PositionMap>(loadPositions)

  const getOffset = useCallback(
    (panelId: string): PanelOffset => positions[panelId] ?? { dx: 0, dy: 0 },
    [positions],
  )

  const updateOffset = useCallback((panelId: string, dx: number, dy: number) => {
    setPositions((prev) => {
      const next = { ...prev, [panelId]: { dx, dy } }
      savePositions(next)
      return next
    })
  }, [])

  const resetAll = useCallback(() => {
    setPositions({})
    try {
      localStorage.removeItem(STORAGE_KEY)
    } catch {
      // ignore
    }
  }, [])

  const hasCustomPositions = Object.keys(positions).length > 0

  return { getOffset, updateOffset, resetAll, hasCustomPositions }
}

/** Drag handler for pointer events — attach to a drag handle element */
export function useDragHandler(
  panelId: string,
  editMode: boolean,
  getOffset: (id: string) => PanelOffset,
  updateOffset: (id: string, dx: number, dy: number) => void,
) {
  const dragState = useRef<{ startX: number; startY: number; origDx: number; origDy: number } | null>(null)

  const onPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if (!editMode) return
      const offset = getOffset(panelId)
      dragState.current = {
        startX: e.clientX,
        startY: e.clientY,
        origDx: offset.dx,
        origDy: offset.dy,
      }
      ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
      e.preventDefault()
    },
    [editMode, panelId, getOffset],
  )

  const onPointerMove = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      const { startX, startY, origDx, origDy } = dragState.current
      const dx = origDx + (e.clientX - startX)
      const dy = origDy + (e.clientY - startY)
      const el = (e.target as HTMLElement).closest('[data-panel-id]') as HTMLElement | null
      if (el) {
        el.style.transform = `translate(${dx}px, ${dy}px)`
      }
    },
    [],
  )

  const onPointerUp = useCallback(
    (e: React.PointerEvent) => {
      if (!dragState.current) return
      const { startX, startY, origDx, origDy } = dragState.current
      const dx = origDx + (e.clientX - startX)
      const dy = origDy + (e.clientY - startY)
      dragState.current = null
      if (Math.abs(dx - origDx) > 3 || Math.abs(dy - origDy) > 3) {
        updateOffset(panelId, dx, dy)
      }
    },
    [panelId, updateOffset],
  )

  return { onPointerDown, onPointerMove, onPointerUp }
}
