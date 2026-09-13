'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { buildStats, type PuzzleRow, type PuzzleStats } from '@/lib/puzzleStats'

/* Every screen reads the same table, so the rows are fetched once per page load
   and shared. `refresh()` drops the cache after a write. */
let cachedRows: PuzzleRow[] | null = null
let inFlight: Promise<PuzzleRow[]> | null = null

async function fetchRows(): Promise<PuzzleRow[]> {
  const { data, error } = await supabase
    .from('puzzle_times')
    .select('date, time_seconds')
    .order('date', { ascending: true })
  if (error) throw new Error(error.message)
  return (data ?? []) as PuzzleRow[]
}

export function invalidatePuzzleTimes() {
  cachedRows = null
  inFlight = null
}

export function usePuzzleTimes() {
  const [stats, setStats] = useState<PuzzleStats | null>(() =>
    cachedRows ? buildStats(cachedRows) : null
  )
  const [loading, setLoading] = useState(!cachedRows)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let active = true

    if (cachedRows) {
      setStats(buildStats(cachedRows))
      setLoading(false)
      return
    }

    if (!inFlight) {
      inFlight = fetchRows()
        .then(rows => {
          cachedRows = rows
          return rows
        })
        .finally(() => {
          inFlight = null
        })
    }

    setLoading(true)
    inFlight
      .then(rows => {
        if (!active) return
        setStats(buildStats(rows))
        setError(null)
      })
      .catch((err: unknown) => {
        if (!active) return
        setError(err instanceof Error ? err.message : String(err))
      })
      .finally(() => {
        if (active) setLoading(false)
      })

    return () => {
      active = false
    }
  }, [])

  return { stats, loading, error }
}
