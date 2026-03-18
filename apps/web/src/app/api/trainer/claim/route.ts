import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { getChannelName } from '@jarvis-dcs/shared'

// In-memory IP rate limiter — 5 attempts per 60s window, resets on server restart
const RATE_LIMIT_WINDOW_MS = 60_000
const RATE_LIMIT_MAX_ATTEMPTS = 5
const rateLimitMap = new Map<string, { count: number; resetAt: number }>()

function checkRateLimit(ip: string): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(ip)
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS })
    return true
  }
  if (entry.count >= RATE_LIMIT_MAX_ATTEMPTS) return false
  entry.count++
  return true
}

/** POST /api/trainer/claim — Resolve a 4-digit trainer code to a sessionId + channelName (no auth required) */
export async function POST(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    ?? req.headers.get('x-real-ip')
    ?? 'unknown'
  if (!checkRateLimit(ip)) {
    return NextResponse.json({ error: 'Too many attempts — try again later' }, { status: 429 })
  }

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

  // Attempt to claim controller role — only succeeds if no controller exists yet
  const { data: updated } = await supabase
    .from('sessions')
    .update({ trainer_role: 'controller' })
    .eq('id', session.id)
    .is('trainer_role', null)
    .select('trainer_role')
    .single()

  const role = updated ? 'controller' : 'observer'

  return NextResponse.json({
    sessionId: session.id,
    channelName: getChannelName(session.id),
    role,
  })
}
