'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LAST_SELECTED_PUZZLE_DATE_KEY } from '@/lib/storageKeys'
import NavPill from '@/components/NavPill'

const getTodayDate = () => new Date().toISOString().slice(0, 10)

const getStoredDate = (): string | null => {
  if (typeof window === 'undefined') return null
  const stored = window.localStorage.getItem(LAST_SELECTED_PUZZLE_DATE_KEY)
  return stored && /^\d{4}-\d{2}-\d{2}$/.test(stored) ? stored : null
}

export default function EntryPage() {
  const [date, setDate] = useState<string>(() => getStoredDate() ?? getTodayDate())
  const [digits, setDigits] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const todayIso = getTodayDate()

  useEffect(() => {
    if (typeof window === 'undefined') {
      return
    }
    const stored = getStoredDate()
    if (stored) {
      setDate(stored)
    }
    const handleStorage = (event: StorageEvent) => {
      if (event.key === LAST_SELECTED_PUZZLE_DATE_KEY && typeof event.newValue === 'string') {
        setDate(event.newValue)
      }
    }
    window.addEventListener('storage', handleStorage)
    return () => {
      window.removeEventListener('storage', handleStorage)
    }
  }, [])

  const updateDate = (nextDate: string) => {
    setDate(nextDate)
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SELECTED_PUZZLE_DATE_KEY, nextDate)
    }
  }

  // Format digits into MM:SS
  const formattedTime = (() => {
    const d = digits.replace(/\D/g, '').slice(-4)
    let mm = '00'
    let ss = '00'
    if (d.length <= 2) {
      ss = d.padStart(2, '0')
    } else {
      mm = d.slice(0, -2).padStart(2, '0')
      ss = d.slice(-2)
    }
    return `${mm}:${ss}`
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
    setLoading(true)
    setMessage(null)

    // Prevent future dates
    const today = getTodayDate()
    if (date > today) {
      setMessage('Cannot log time for a future date.')
      setLoading(false)
      return
    }

    // Retrieve current user's session
    const {
      data: { session },
      error: sessionError,
    } = await supabase.auth.getSession()
    if (sessionError || !session?.user) {
      setMessage('Error: Unable to get user session.')
      setLoading(false)
      return
    }

    // Prevent duplicate entry for same date
    const { data: existing, error: existingError } = await supabase
      .from('puzzle_times')
      .select('id')
      .eq('user_id', session.user.id)
      .eq('date', date)
      .single()

    if (existing) {
      setMessage('You have already logged a time for this date.')
      setLoading(false)
      return
    }
    if (existingError && existingError.code !== 'PGRST116') {
      // PGRST116 = No rows found
      setMessage(`Error checking existing entry: ${existingError.message}`)
      setLoading(false)
      return
    }

    // Convert formatted time to seconds
    const [minStr, secStr] = formattedTime.split(':')
    const totalSeconds = parseInt(minStr, 10) * 60 + parseInt(secStr, 10)

    // Insert new record
    const { error } = await supabase.from('puzzle_times').insert({
      user_id: session.user.id,
      date,
      time_seconds: totalSeconds,
    })

    setLoading(false)
    if (error) {
      setMessage(`Error: ${error.message}`)
    } else {
      setMessage('Puzzle time saved!')
      setDigits('')
    }
  }

  return (
    <main className="relative mx-auto flex min-h-screen max-w-5xl flex-col gap-8 px-5 py-16">
      <div className="space-y-3">
        <NavPill currentHref="/entry" />
        <h1 className="text-3xl font-extrabold text-white md:text-4xl">Quick Entry</h1>
      </div>

      <section className="relative overflow-hidden rounded-3xl border border-white/10 bg-white/5 p-8 shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_60%_0%,rgba(255,255,255,0.08),transparent_40%)]" />
        <div className="relative grid gap-8 lg:grid-cols-[1.2fr_1fr]">
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 transition hover:border-emerald-300/50">
                <span className="text-xs uppercase tracking-[0.18em] text-white/60">Date</span>
                <input
                  type="date"
                  value={date}
                  max={todayIso}
                  onChange={e => updateDate(e.target.value)}
                  className="w-full rounded-xl border border-white/10 bg-[#0c182e]/70 px-3 py-2 text-white shadow-inner focus:border-emerald-300 focus:outline-none"
                  required
                />
              </label>
              <label className="group flex flex-col gap-2 rounded-2xl border border-white/10 bg-white/5 p-4 text-sm text-white/70 transition hover:border-sky-300/50">
                <span className="text-xs uppercase tracking-[0.18em] text-white/60">Time (MM:SS)</span>
                <input
                  type="text"
                  value={formattedTime}
                  onKeyDown={handleTimeKeyDown}
                  placeholder="00:00"
                  readOnly
                  className="w-full rounded-xl border border-white/10 bg-[#0c182e]/70 px-3 py-2 text-white shadow-inner focus:border-sky-300 focus:outline-none"
                  required
                />
              </label>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-xl border border-emerald-300/30 bg-gradient-to-r from-emerald-500/80 to-sky-500/80 px-4 py-3 text-sm font-semibold text-white shadow-[0_15px_40px_rgba(16,185,129,0.35)] transition hover:translate-y-[-2px] hover:shadow-[0_20px_50px_rgba(56,189,248,0.35)] disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Save time'}
            </button>

            {message && (
              <p className="rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-center text-sm text-white/80">
                {message}
              </p>
            )}
          </form>

          <div className="rounded-2xl border border-white/10 bg-[#0c182e]/80 p-6 shadow-inner backdrop-blur-xl">
            <p className="text-xs uppercase tracking-[0.2em] text-white/60">Status</p>
            <p className="mt-3 text-lg font-semibold text-white">Entry guardrails on</p>
            <p className="mt-2 text-sm text-white/70">
              Future dates are blocked and times stay locked to MM:SS for clean logs.
            </p>
          </div>
        </div>
      </section>
    </main>
  )
}
