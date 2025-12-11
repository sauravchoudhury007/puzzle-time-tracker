import { NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY!
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey)

const isoDatePattern = /^\d{4}-\d{2}-\d{2}$/

const todayIso = () => new Date().toISOString().slice(0, 10)

// Lock CORS to your site and extension only.
// You can override via env: CORS_ORIGIN and CORS_EXTENSION_ORIGIN.
const allowedOrigins = [
  process.env.CORS_ORIGIN ?? 'https://sharvaniandsauravplayminis.mr007.live',
  process.env.CORS_EXTENSION_ORIGIN ?? 'chrome-extension://nagiconhkfiolipdggbjeibpmcjhdmko',
].filter(Boolean)

const buildCorsHeaders = (origin: string | null) => {
  if (!origin || !allowedOrigins.includes(origin)) return null
  return {
    'Access-Control-Allow-Origin': origin,
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  }
}

export function OPTIONS(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = buildCorsHeaders(origin)
  if (!corsHeaders) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }
  return NextResponse.json({}, { headers: corsHeaders })
}

export async function POST(request: Request) {
  const origin = request.headers.get('origin')
  const corsHeaders = buildCorsHeaders(origin)
  if (!corsHeaders) {
    return NextResponse.json({ error: 'Origin not allowed' }, { status: 403 })
  }

  const authHeader = request.headers.get('authorization') || ''
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7) : null

  if (!token) {
    return NextResponse.json({ error: 'Missing bearer token' }, { status: 401, headers: corsHeaders })
  }

  const body = await request.json().catch(() => null)
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400, headers: corsHeaders })
  }

  const { date, seconds } = body as { date?: unknown; seconds?: unknown }

  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return NextResponse.json({ error: 'seconds must be a positive number' }, { status: 400, headers: corsHeaders })
  }

  const targetDate =
    typeof date === 'string' && isoDatePattern.test(date) ? date : todayIso()

  if (targetDate > todayIso()) {
    return NextResponse.json({ error: 'Date cannot be in the future' }, { status: 400, headers: corsHeaders })
  }

  const { data: userData, error: userError } = await supabaseAdmin.auth.getUser(token)
  if (userError || !userData?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401, headers: corsHeaders })
  }

  const userId = userData.user.id
  const secondsRounded = Math.round(seconds)

  const { data: existing, error: existingError } = await supabaseAdmin
    .from('puzzle_times')
    .select('id')
    .eq('user_id', userId)
    .eq('date', targetDate)
    .maybeSingle()

  if (existingError && existingError.code !== 'PGRST116') {
    return NextResponse.json(
      { error: 'Error checking existing entry', details: existingError.message },
      { status: 500, headers: corsHeaders }
    )
  }

  if (existing) {
    return NextResponse.json({ status: 'already_logged', id: existing.id }, { headers: corsHeaders })
  }

  const { data: inserted, error: insertError } = await supabaseAdmin
    .from('puzzle_times')
    .insert({
      user_id: userId,
      date: targetDate,
      time_seconds: secondsRounded,
    })
    .select('id, date, time_seconds')
    .single()

  if (insertError) {
    return NextResponse.json(
      { error: 'Failed to save time', details: insertError.message },
      { status: 500, headers: corsHeaders }
    )
  }

  return NextResponse.json({ status: 'ok', entry: inserted }, { headers: corsHeaders })
}
