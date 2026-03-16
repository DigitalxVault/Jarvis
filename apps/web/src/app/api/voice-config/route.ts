import { NextResponse } from 'next/server'

export const runtime = 'nodejs'

/**
 * Serves voice pipeline config (Picovoice access key) to the browser.
 * Keeps keys out of NEXT_PUBLIC_ env vars and client bundles.
 */
export async function GET() {
  const picovoiceKey = process.env.PICOVOICE_ACCESS_KEY

  if (!picovoiceKey) {
    return NextResponse.json({ error: 'Picovoice key not configured' }, { status: 500 })
  }

  return NextResponse.json({
    picovoiceAccessKey: picovoiceKey,
  })
}
