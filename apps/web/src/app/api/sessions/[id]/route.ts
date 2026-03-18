import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabase } from '@/lib/supabase-server'

/** PATCH /api/sessions/:id — End an active session */
export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

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

  // Build update object — ended_at is optional; update silently succeeds if column doesn't exist
  const updateData: Record<string, unknown> = { status: 'ended' }
  try {
    // Attempt to include ended_at; if the column doesn't exist Supabase will return an error
    // which we handle by falling back to status-only update
    const { error } = await supabase
      .from('sessions')
      .update({ ...updateData, ended_at: new Date().toISOString() })
      .eq('id', id)
      .eq('user_id', session.user.id)

    if (error) {
      // If the error is about an unknown column, retry without ended_at
      const isColumnMissing =
        error.message?.includes('ended_at') ||
        error.code === '42703'

      if (isColumnMissing) {
        const { error: retryErr } = await supabase
          .from('sessions')
          .update(updateData)
          .eq('id', id)
          .eq('user_id', session.user.id)

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
