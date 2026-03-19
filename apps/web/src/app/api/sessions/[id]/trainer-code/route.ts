import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { TRAINER_CODE_MIN, TRAINER_CODE_MAX } from '@jarvis-dcs/shared'

function generateTrainerCode(): string {
  return Math.floor(
    TRAINER_CODE_MIN + Math.random() * (TRAINER_CODE_MAX - TRAINER_CODE_MIN + 1)
  ).toString()
}

/** POST /api/sessions/:id/trainer-code — Generate a 4-digit trainer code for an active session */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = createServerSupabase()

  // Verify the session exists and is active
  const { data: dbSession, error: findErr } = await supabase
    .from('sessions')
    .select('id, status')
    .eq('id', id)
    .eq('status', 'active')
    .single()

  if (findErr || !dbSession) {
    return NextResponse.json({ error: 'Session not found or not active' }, { status: 404 })
  }

  // Try up to 5 times to find a unique trainer code
  for (let attempt = 0; attempt < 5; attempt++) {
    const code = generateTrainerCode()

    const { error: updateErr } = await supabase
      .from('sessions')
      .update({ trainer_code: code })
      .eq('id', id)

    if (!updateErr) {
      return NextResponse.json({ trainerCode: code })
    }

    // If unique constraint violation, retry; otherwise bail
    const isUniqueViolation =
      updateErr.code === '23505' || updateErr.message?.includes('unique')
    if (!isUniqueViolation) {
      console.error('[API] Failed to set trainer code:', updateErr)
      return NextResponse.json({ error: 'Failed to generate trainer code' }, { status: 500 })
    }
  }

  return NextResponse.json({ error: 'Could not generate unique trainer code' }, { status: 500 })
}
