'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LAST_SELECTED_PUZZLE_DATE_KEY } from '@/lib/storageKeys'
import NavBar from '@/components/pulse/NavBar'
import { Card, PageShell } from '@/components/pulse/Surface'
import { invalidatePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { fmtDateLong, todayIso } from '@/lib/format'

const getStoredDate = (): string | null => {
  if (typeof window === 'undefined') return null
  try {
    const stored = window.localStorage.getItem(LAST_SELECTED_PUZZLE_DATE_KEY)
    return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null
  } catch {
    return null
  }
}

type Status = { kind: 'ok' | 'error' | 'info'; text: string }

export default function EntryPage() {
  const [date, setDate] = useState<string>(() => getStoredDate() ?? todayIso())
  const [digits, setDigits] = useState('')
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<Status | null>(null)
  const today = todayIso()

  useEffect(() => {
    const stored = getStoredDate()
    if (stored) setDate(stored)

    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_SELECTED_PUZZLE_DATE_KEY && typeof event.newValue === 'string') {
        setDate(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => window.removeEventListener('storage', handleStorage)
  }, [])

  const updateDate = (next: string) => {
    setDate(next)
    try {
      window.localStorage.setItem(LAST_SELECTED_PUZZLE_DATE_KEY, next)
    } catch {
      // Private browsing — the date just will not persist.
    }
  }

  // Digits fill from the right, so typing 1·1·4 reads 01:14.
  const formattedTime = (() => {
    const d = digits.replace(/\D/g, '').slice(-4)
    if (d.length <= 2) return `00:${d.padStart(2, '0')}`
    return `${d.slice(0, -2).padStart(2, '0')}:${d.slice(-2)}`
  })()

  const totalSeconds = (() => {
    const [m, s] = formattedTime.split(':')
    return parseInt(m, 10) * 60 + parseInt(s, 10)
  })()

  const handleTimeKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace') {
      setDigits(prev => prev.slice(0, -1))
      e.preventDefault()
    } else if (/^[0-9]$/.test(e.key)) {
      setDigits(prev => (prev + e.key).slice(-4))
      e.preventDefault()
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setStatus(null)

    if (date > today) {
      setStatus({ kind: 'error', text: 'Cannot log a time for a future date.' })
      return
    }
    if (totalSeconds <= 0) {
      setStatus({ kind: 'error', text: 'Enter a time first — type the digits.' })
      return
    }

    setLoading(true)

    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()

    if (sessionError || !session?.user) {
      setStatus({ kind: 'error', text: 'Unable to get your session. Try signing in again.' })
      setLoading(false)
      return
    }

    const { data: existing, error: existingError } = await supabase
      .from('puzzle_times')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .maybeSingle()

    if (existing) {
      setStatus({ kind: 'info', text: 'A time is already logged for this date.' })
      setLoading(false)
      return
    }
    if (existingError && existingError.code !== 'PGRST116') {
      setStatus({ kind: 'error', text: `Error checking existing entry: ${existingError.message}` })
      setLoading(false)
      return
    }

    const { error } = await supabase.from('puzzle_times').insert({
      user_id: session.user.id,
      date,
      time_seconds: totalSeconds,
    })

    setLoading(false)
    if (error) {
      setStatus({ kind: 'error', text: error.message })
    } else {
      invalidatePuzzleTimes()
      setStatus({ kind: 'ok', text: `Logged ${formattedTime} for ${fmtDateLong(date)}.` })
      setDigits('')
    }
  }

  const statusColor =
    status?.kind === 'error' ? 'var(--negative)' : status?.kind === 'ok' ? 'var(--accent)' : 'var(--muted)'

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <PageShell maxWidth={900}>
        <div style={{ marginBottom: 28 }}>
          <div className="eyebrow">Log a time</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(44px, 8vw, 84px)',
              lineHeight: 0.95,
              letterSpacing: '-.03em',
              margin: '14px 0 0',
              fontWeight: 400,
            }}
          >
            How did this morning go?
          </h1>
        </div>

        <Card>
          <form onSubmit={handleSubmit}>
            <label style={{ display: 'block' }}>
              <span className="eyebrow">Puzzle date</span>
              <input
                type="date"
                value={date}
                max={today}
                onChange={e => updateDate(e.target.value)}
                required
                style={{
                  display: 'block',
                  width: '100%',
                  marginTop: 8,
                  background: 'var(--surface2)',
                  border: '1px solid var(--rule-soft)',
                  borderRadius: 'var(--card-r)',
                  padding: '12px 14px',
                  fontFamily: 'var(--mono)',
                  fontSize: 14,
                  color: 'var(--ink)',
                }}
              />
            </label>

            <div style={{ margin: '32px 0 8px', textAlign: 'center' }}>
              <span className="eyebrow">Solve time · type the digits</span>
            </div>
            <input
              type="text"
              value={formattedTime}
              onKeyDown={handleTimeKeyDown}
              onChange={() => {}}
              inputMode="numeric"
              aria-label="Solve time in minutes and seconds"
              style={{
                display: 'block',
                width: '100%',
                background: 'transparent',
                border: 0,
                textAlign: 'center',
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 'clamp(72px, 16vw, 150px)',
                letterSpacing: '-.05em',
                lineHeight: 1,
                color: digits ? 'var(--ink)' : 'var(--muted)',
                fontFeatureSettings: '"tnum","lnum"',
                padding: 0,
              }}
            />
            <div
              style={{
                textAlign: 'center',
                marginTop: 10,
                fontFamily: 'var(--mono)',
                fontSize: 11,
                letterSpacing: '.18em',
                textTransform: 'uppercase',
                color: 'var(--muted)',
              }}
            >
              {totalSeconds > 0 ? `${totalSeconds} seconds` : 'Backspace to correct'}
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                marginTop: 32,
                width: '100%',
                background: 'var(--accent)',
                color: '#0c0c0a',
                border: 0,
                borderRadius: 'var(--card-r)',
                padding: '16px 20px',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.22em',
                textTransform: 'uppercase',
                cursor: loading ? 'default' : 'pointer',
                opacity: loading ? 0.6 : 1,
              }}
            >
              {loading ? 'Saving…' : 'Save time'}
            </button>

            {status && (
              <p
                role="status"
                style={{
                  marginTop: 18,
                  textAlign: 'center',
                  fontFamily: 'var(--sans)',
                  fontSize: 14,
                  color: statusColor,
                }}
              >
                {status.text}
              </p>
            )}
          </form>
        </Card>

        <p
          style={{
            marginTop: 18,
            fontFamily: 'var(--sans)',
            fontSize: 13,
            color: 'var(--muted)',
            lineHeight: 1.6,
          }}
        >
          Future dates are blocked, and each date takes one time — the same rules the browser
          extension follows when it logs automatically.
        </p>
      </PageShell>
    </main>
  )
}
