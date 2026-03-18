'use client'

import { createContext, use, useMemo } from 'react'

export type TrainerRole = 'controller' | 'observer'

interface TrainerRoleContextValue {
  role: TrainerRole
  isObserver: boolean
}

const TrainerRoleContext = createContext<TrainerRoleContextValue>({
  role: 'controller',
  isObserver: false,
})

interface TrainerRoleProviderProps {
  role: TrainerRole
  children: React.ReactNode
}

export function TrainerRoleProvider({ role, children }: TrainerRoleProviderProps) {
  const value = useMemo<TrainerRoleContextValue>(
    () => ({ role, isObserver: role === 'observer' }),
    [role]
  )

  return <TrainerRoleContext value={value}>{children}</TrainerRoleContext>
}

export function useTrainerRole(): TrainerRoleContextValue {
  return use(TrainerRoleContext)
}
