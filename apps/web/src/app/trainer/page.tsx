'use client'

import { Suspense, useState, useEffect } from 'react'
import { useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'

const TrainerEntry = dynamic(
  () => import('@/components/trainer/trainer-entry').then((m) => m.TrainerEntry),
  { ssr: false }
)

const TrainerDashboard = dynamic(
  () => import('@/components/trainer/trainer-dashboard').then((m) => m.TrainerDashboard),
  { ssr: false }
)

type PageState = 'entry' | 'joining' | 'dashboard'

export default function TrainerPage() {
  return (
    <Suspense fallback={null}>
      <TrainerPageInner />
    </Suspense>
  )
}

function TrainerPageInner() {
  const searchParams = useSearchParams()
  const [state, setState] = useState<PageState>('entry')
  const [sessionId, setSessionId] = useState<string | null>(null)
  const [role, setRole] = useState<'controller' | 'observer'>('controller')
  const [joinError, setJoinError] = useState<string | null>(null)

  // On mount: check for observer deep-link URL params
  useEffect(() => {
    const paramSession = searchParams.get('session')
    const paramRole = searchParams.get('role')
    const paramToken = searchParams.get('token')

    if (paramSession && paramRole === 'observer' && paramToken) {
      setState('joining')
      fetch('/api/trainer/observe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ sessionId: paramSession, token: paramToken }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          if (res.ok) {
            setSessionId(data.sessionId as string)
            setRole('observer')
            setState('dashboard')
          } else {
            setJoinError(
              data.error === 'Invalid or expired link'
                ? 'LINK EXPIRED OR INVALID'
                : 'FAILED TO JOIN SESSION'
            )
            setState('entry')
          }
        })
        .catch(() => {
          setJoinError('CONNECTION ERROR — TRY AGAIN')
          setState('entry')
        })
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleResolved(resolvedSessionId: string, resolvedRole?: 'controller' | 'observer') {
    setSessionId(resolvedSessionId)
    setRole(resolvedRole ?? 'controller')
    setState('dashboard')
  }

  function handleExit() {
    setSessionId(null)
    setRole('controller')
    setState('entry')
  }

  if (state === 'joining') {
    return (
      <div
        className="min-h-screen bg-jarvis-bg flex items-center justify-center"
        style={{ fontFamily: 'Courier New, monospace' }}
      >
        <div className="jarvis-panel relative w-full max-w-sm mx-4 text-center">
          <div className="corner-bracket corner-tl" />
          <div className="corner-bracket corner-tr" />
          <div className="corner-bracket corner-bl" />
          <div className="corner-bracket corner-br" />
          <div
            className="text-jarvis-accent animate-pulse"
            style={{ fontSize: '10px', letterSpacing: '4px', padding: '32px 16px' }}
          >
            JOINING SESSION AS OBSERVER...
          </div>
        </div>
      </div>
    )
  }

  if (state === 'entry') {
    return (
      <TrainerEntry
        onResolved={handleResolved}
        observerJoinError={joinError ?? undefined}
      />
    )
  }

  if (state === 'dashboard' && sessionId) {
    return (
      <TrainerDashboard
        sessionId={sessionId}
        role={role}
        onExit={handleExit}
      />
    )
  }

  return null
}
