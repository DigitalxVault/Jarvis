import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

/** Max age for unclaimed sessions (minutes). Older ones are auto-expired. */
const STALE_SESSION_MINUTES = 10

/** POST /api/bridge/claim — Bridge claims a session.
 *  Body: {}              → auto-discover latest unclaimed session
 *  Body: { code: "X" }   → find by pairing code (legacy compat)
 */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}))
  const supabase = createServerSupabase()

  // --- Cleanup stale unclaimed sessions (older than 10 min) ---
  const staleCutoff = new Date(Date.now() - STALE_SESSION_MINUTES * 60 * 1000).toISOString()
  await supabase
    .from('sessions')
    .update({ status: 'expired' })
    .eq('bridge_claimed', false)
    .eq('status', 'active')
    .lt('created_at', staleCutoff)

  let session: Record<string, unknown> | null = null

  if (body?.code) {
    // --- Legacy: find by pairing code ---
    const code = String(body.code).toUpperCase().trim()

    const { data, error: findErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('pairing_code', code)
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

    session = data
  } else {
    // --- Auto-discovery: find latest unclaimed active session ---
    const { data, error: findErr } = await supabase
      .from('sessions')
      .select('*')
      .eq('bridge_claimed', false)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (findErr || !data) {
      return NextResponse.json({ error: 'No unclaimed session available' }, { status: 404 })
    }

    session = data
  }

  const sessionId = (session as { id: string }).id

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
