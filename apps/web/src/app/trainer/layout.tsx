import type { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'J·A·R·V·I·S // Trainer View',
}

/**
 * Trainer segment layout.
 *
 * ISOLATION NOTE: The root layout.tsx wraps all pages in <TelemetryProvider> and
 * <JarvisVoiceProvider>. Next.js nested layouts do NOT replace the root layout —
 * they render inside it. This layout therefore does NOT re-add those providers.
 *
 * True isolation is achieved by having trainer components call useTelemetry(sessionId)
 * directly instead of useTelemetryContext(), and by never importing JarvisVoiceProvider
 * hooks inside trainer components.
 *
 * The root providers are present in the React tree but remain inert for the trainer
 * route because no trainer component consumes them.
 */
export default function TrainerLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return <>{children}</>
}
