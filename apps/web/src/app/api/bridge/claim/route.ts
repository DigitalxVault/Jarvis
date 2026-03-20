import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

/** POST /api/bridge/claim — Bridge claims a session by pairing code.
 *  Body: { code: "ABC123" }
 *
 *  Kept for future use (manual pairing). Auto-discovery removed —
 *  bridge defaults to session:dev and doesn't need a DB session.
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const code = body?.code

  if (!code || typeof code !== 'string') {
    return NextResponse.json({ error: 'Missing pairing code' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const trimmed = code.toUpperCase().trim()

  const { data, error: findErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('pairing_code', trimmed)
    .eq('bridge_claimed', false)
    .eq('status', 'active')
    .single()

  if (findErr || !data) {
    return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 })
  }

  // Check TTL
  if (data.pairing_expires_at && new Date(data.pairing_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Pairing code has expired' }, { status: 410 })
  }

  const sessionId = data.id

  // Claim the session (single-use)
  const { error: claimErr } = await supabase
    .from('sessions')
    .update({
      bridge_claimed: true,
      pairing_code: null,
    })
    .eq('id', sessionId)
    .eq('bridge_claimed', false) // Optimistic lock

  if (claimErr) {
    return NextResponse.json({ error: 'Failed to claim session' }, { status: 500 })
  }

  return NextResponse.json({
    channelName: getChannelName(sessionId),
    sessionId,
  })
}
