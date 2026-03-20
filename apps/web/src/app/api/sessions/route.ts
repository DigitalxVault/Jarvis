import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'

/** POST /api/sessions — Create a new session (bridge auto-discovers it) */
export async function POST() {
  try {
    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('sessions')
      .insert({
        user_id: 'anonymous',
        status: 'active',
        pairing_code: null,
        pairing_expires_at: null,
      })
      .select()
      .single()

    if (error) {
      console.error('[API] Session creation failed:', error)
      return NextResponse.json({ error: error.message || 'Failed to create session' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch (err) {
    console.error('[API] Session route crashed:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Internal error' },
      { status: 500 },
    )
  }
}

/** GET /api/sessions — List current user's sessions */
export async function GET() {
  try {
    const { auth } = await import('@/auth')
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const supabase = createServerSupabase()

    const { data, error } = await supabase
      .from('sessions')
      .select('*')
      .eq('user_id', session.user.id)
      .order('created_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Failed to fetch sessions' }, { status: 500 })
    }

    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Auth not configured' }, { status: 401 })
  }
}
