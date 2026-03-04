import type { Metadata, Viewport } from 'next'
import './globals.css'
import { TelemetryProvider } from '@/providers/telemetry-provider'

export const metadata: Metadata = {
  title: 'J·A·R·V·I·S // DCS Telemetry',
  description: 'Realtime DCS World telemetry dashboard',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'JARVIS DCS',
  },
  other: {
    'mobile-web-app-capable': 'yes',
  },
  icons: {
    apple: '/icons/apple-touch-icon.png',
  },
}

export const viewport: Viewport = {
  themeColor: '#010a1a',
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
