import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'JARVIS // DCS Telemetry',
    short_name: 'JARVIS DCS',
    description: 'Realtime DCS World telemetry dashboard',
    start_url: '/',
    display: 'standalone',
    background_color: '#010a1a',
    theme_color: '#010a1a',
    icons: [
      {
        src: '/icons/icon-192x192.png',
        sizes: '192x192',
        type: 'image/png',
      },
      {
        src: '/icons/icon-512x512.png',
        sizes: '512x512',
        type: 'image/png',
      },
      {
        src: '/icons/icon-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
  }
}
