import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

/** POST /api/trainer/observe — Validate an observer token and return session info with observer role */
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null)
  const sessionId = body?.sessionId ? String(body.sessionId).trim() : null
  const token = body?.token ? String(body.token).trim() : null

  if (!sessionId || !token) {
    return NextResponse.json({ error: 'Missing sessionId or token' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  const { data: session, error } = await supabase
    .from('sessions')
    .select('id')
    .eq('id', sessionId)
    .eq('observer_token', token)
    .eq('status', 'active')
    .single()

  if (error || !session) {
    return NextResponse.json({ error: 'Invalid or expired link' }, { status: 404 })
  }

  return NextResponse.json({
    sessionId: session.id,
    channelName: getChannelName(session.id),
    role: 'observer',
  })
}
