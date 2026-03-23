'use client'

import dynamic from 'next/dynamic'
import { useTelemetryContext } from '@/providers/telemetry-provider'
import { StartCodeEntry } from '@/components/start-code-entry'

const Dashboard = dynamic(() => import('@/components/dashboard').then(m => m.Dashboard), {
  ssr: false,
})

export default function Home() {
  const { isUnlocked, setUnlocked } = useTelemetryContext()

  if (!isUnlocked) {
    return <StartCodeEntry onUnlocked={() => setUnlocked(true)} />
  }

  return <Dashboard />
}
