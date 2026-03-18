'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'

const TrainerEntry = dynamic(
  () => import('@/components/trainer/trainer-entry').then((m) => m.TrainerEntry),
  { ssr: false }
)

const TrainerDashboard = dynamic(
  () => import('@/components/trainer/trainer-dashboard').then((m) => m.TrainerDashboard),
  { ssr: false }
)

type PageState = 'entry' | 'connecting' | 'dashboard'

export default function TrainerPage() {
  const [state, setState] = useState<PageState>('entry')
  const [sessionId, setSessionId] = useState<string | null>(null)

  function handleResolved(resolvedSessionId: string) {
    setSessionId(resolvedSessionId)
    setState('dashboard')
  }

  function handleExit() {
    setSessionId(null)
    setState('entry')
  }

  if (state === 'entry') {
    return <TrainerEntry onResolved={handleResolved} />
  }

  if ((state === 'connecting' || state === 'dashboard') && sessionId) {
    return <TrainerDashboard sessionId={sessionId} onExit={handleExit} />
  }

  return null
}
