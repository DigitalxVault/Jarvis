import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

// TODO: rate-limit this endpoint (9000 possible codes, brute-force risk)

/** POST /api/trainer/claim — Resolve a 4-digit trainer code to a sessionId + channelName (no auth required) */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const code = body?.code ? String(body.code).trim() : null

  // Validate code format: must be exactly 4 digits
  if (!code || !/^\d{4}$/.test(code)) {
    return NextResponse.json({ error: 'Invalid code format' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  // Find the active session with this trainer code
  const { data: session, error: findErr } = await supabase
    .from('sessions')
    .select('id')
    .eq('trainer_code', code)
    .eq('status', 'active')
    .single()

  if (findErr || !session) {
    return NextResponse.json({ error: 'Session not found' }, { status: 404 })
  }

  return NextResponse.json({
    sessionId: session.id,
    channelName: getChannelName(session.id),
  })
}
