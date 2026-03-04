import type { Metadata, Viewport } from 'next'
import './globals.css'
import { TelemetryProvider } from '@/providers/telemetry-provider'
import { SwRegister } from '@/components/pwa/sw-register'
import { UpdateBanner } from '@/components/pwa/update-banner'
import { InstallPrompt } from '@/components/pwa/install-prompt'

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
        <SwRegister />
        <UpdateBanner />
        <InstallPrompt />
      </body>
    </html>
  )
}
