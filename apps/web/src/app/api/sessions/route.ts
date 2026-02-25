import { NextResponse } from 'next/server'
import { auth } from '@/auth'
import { createServerSupabase } from '@/lib/supabase-server'
import {
  PAIRING_CHARSET,
  PAIRING_CODE_LENGTH,
  PAIRING_CODE_TTL_MINUTES,
} from '@jarvis-dcs/shared'

function generatePairingCode(): string {
  let code = ''
  const bytes = crypto.getRandomValues(new Uint8Array(PAIRING_CODE_LENGTH))
  for (let i = 0; i < PAIRING_CODE_LENGTH; i++) {
    code += PAIRING_CHARSET[bytes[i] % PAIRING_CHARSET.length]
  }
  return code
}

/** POST /api/sessions — Create a new session with a pairing code */
export async function POST() {
  const session = await auth()
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServerSupabase()
  const pairingCode = generatePairingCode()
  const expiresAt = new Date(Date.now() + PAIRING_CODE_TTL_MINUTES * 60 * 1000).toISOString()

  const { data, error } = await supabase
    .from('sessions')
    .insert({
      user_id: session.user.id,
      status: 'active',
      pairing_code: pairingCode,
      pairing_expires_at: expiresAt,
    })
    .select()
    .single()

  if (error) {
    console.error('[API] Session creation failed:', error)
    return NextResponse.json({ error: 'Failed to create session' }, { status: 500 })
  }

  return NextResponse.json(data)
}

/** GET /api/sessions — List current user's sessions */
export async function GET() {
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
}
