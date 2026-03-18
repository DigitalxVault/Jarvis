import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/** POST /api/sessions/[id]/observer-link — Generate (or retrieve) an observer deep-link for a session */
export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id: sessionId } = await params
  if (!sessionId) {
    return NextResponse.json({ error: 'Missing session id' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  // Fetch current session to check it exists and is active
  const { data: session, error } = await supabase
    .from('sessions')
    .select('id, observer_token, status')
    .eq('id', sessionId)
    .single()

  if (error || !session || session.status !== 'active') {
    return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })
  }

  // Reuse existing token if already generated (idempotent)
  let token = session.observer_token as string | null

  if (!token) {
    token = crypto.randomUUID()
    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ observer_token: token })
      .eq('id', sessionId)

    if (updateErr) {
      return NextResponse.json({ error: 'Failed to generate observer token' }, { status: 500 })
    }
  }

  // Build the observer URL
  const baseUrl =
    process.env.NEXT_PUBLIC_APP_URL ||
    req.nextUrl.origin

  const observerLink = `${baseUrl}/trainer?session=${sessionId}&role=observer&token=${token}`

  return NextResponse.json({ observerLink, observerToken: token })
}
