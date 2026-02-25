import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

/** POST /api/bridge/claim — Bridge claims a pairing code */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  if (!body?.code) {
    return NextResponse.json({ error: 'Missing pairing code' }, { status: 400 })
  }

  const supabase = createServerSupabase()
  const code = String(body.code).toUpperCase().trim()

  // Find the session with this pairing code
  const { data: session, error: findErr } = await supabase
    .from('sessions')
    .select('*')
    .eq('pairing_code', code)
    .eq('bridge_claimed', false)
    .eq('status', 'active')
    .single()

  if (findErr || !session) {
    return NextResponse.json({ error: 'Invalid or expired pairing code' }, { status: 404 })
  }

  // Check TTL
  if (session.pairing_expires_at && new Date(session.pairing_expires_at) < new Date()) {
    return NextResponse.json({ error: 'Pairing code has expired' }, { status: 410 })
  }

  // Claim the code (single-use)
  const { error: claimErr } = await supabase
    .from('sessions')
    .update({
      bridge_claimed: true,
      pairing_code: null, // Invalidate the code
    })
    .eq('id', session.id)
    .eq('bridge_claimed', false) // Optimistic lock

  if (claimErr) {
    return NextResponse.json({ error: 'Failed to claim pairing code' }, { status: 500 })
  }

  return NextResponse.json({
    channelName: getChannelName(session.id),
    sessionId: session.id,
  })
}
