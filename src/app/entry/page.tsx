'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

export default function EntryPage() {
  const [date, setDate] = useState<string>(new Date().toISOString().slice(0, 10))
  const [digits, setDigits] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState<string | null>(null)

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
    const today = new Date().toISOString().slice(0, 10)
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
    <main className="max-w-md mx-auto mt-16 p-8 bg-white/70 dark:bg-gray-800/70 backdrop-blur-lg rounded-2xl shadow-lg">
      <h1 className="text-2xl font-bold mb-6 text-gray-900 dark:text-gray-100">
        Log Today’s Puzzle
      </h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div>
          <label className="block mb-1 text-gray-700 dark:text-gray-300">Date</label>
          <input
            type="date"
            value={date}
            max={new Date().toISOString().slice(0, 10)}
            onChange={e => setDate(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        <div>
          <label className="block mb-1 text-gray-700 dark:text-gray-300">Time (MM:SS)</label>
          <input
            type="text"
            value={formattedTime}
            onKeyDown={handleTimeKeyDown}
            placeholder="00:00"
            readOnly
            className="w-full rounded-lg border border-gray-300 bg-gray-50 dark:bg-gray-700 px-3 py-2 focus:outline-none focus:ring-2 focus:ring-green-500"
            required
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className={`w-full rounded-lg py-3 font-semibold text-white ${
            loading ? 'bg-gray-400' : 'bg-green-600 hover:bg-green-700'
          }`}
        >
          {loading ? 'Saving…' : 'Save'}
        </button>

        {message && (
          <p className="mt-4 text-center text-sm text-gray-900 dark:text-gray-100">
            {message}
          </p>
        )}
      </form>
    </main>
  )
}