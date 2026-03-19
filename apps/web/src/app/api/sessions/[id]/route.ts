import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/** PATCH /api/sessions/:id — End an active session */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params

  let body: unknown
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { status } = body as { status?: string }
  if (status !== 'ended') {
    return NextResponse.json({ error: 'Only status "ended" is accepted' }, { status: 400 })
  }

  const supabase = createServerSupabase()

  try {
    const { error } = await supabase
      .from('sessions')
      .update({ status: 'ended', ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('status', 'active')

    if (error) {
      // If ended_at column doesn't exist, retry without it
      if (error.message?.includes('ended_at') || error.code === '42703') {
        const { error: retryErr } = await supabase
          .from('sessions')
          .update({ status: 'ended' })
          .eq('id', id)
          .eq('status', 'active')

        if (retryErr) {
          console.error('[API] PATCH session (retry) failed:', retryErr)
          return NextResponse.json({ error: 'Failed to end session' }, { status: 500 })
        }
      } else {
        console.error('[API] PATCH session failed:', error)
        return NextResponse.json({ error: 'Failed to end session' }, { status: 500 })
      }
    }
  } catch (err) {
    console.error('[API] PATCH session unexpected error:', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
