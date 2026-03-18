'use client'

import { useTrainerRole } from './trainer-role-context'

interface ObserverGuardProps {
  children: React.ReactNode
}

/** Wraps interactive controls — renders normally for controllers, disables for observers */
export function ObserverGuard({ children }: ObserverGuardProps) {
  const { isObserver } = useTrainerRole()

  if (!isObserver) {
    return <>{children}</>
  }

  return (
    <div className="relative" style={{ opacity: 0.35, pointerEvents: 'none' }}>
      {children}
      <div
        className="absolute inset-0"
        style={{ pointerEvents: 'auto', cursor: 'not-allowed' }}
        title="Observer mode — read only"
      />
    </div>
  )
}
