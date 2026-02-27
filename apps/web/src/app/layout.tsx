import type { Metadata } from 'next'
import './globals.css'
import { TelemetryProvider } from '@/providers/telemetry-provider'

export const metadata: Metadata = {
  title: 'J·A·R·V·I·S // DCS Telemetry',
  description: 'Realtime DCS World telemetry dashboard',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>
        <TelemetryProvider>
          {children}
        </TelemetryProvider>
      </body>
    </html>
  )
}
