'use client'

import { useEffect, useSyncExternalStore } from 'react'
import { readStoredSession, supabase } from '@/lib/supabaseClient'
import { buildStats, getTodayUtc, type PuzzleRow, type PuzzleStats } from '@/lib/puzzleStats'
import { toDateKey } from '@/lib/dateUtils'
import { PUZZLE_TIMES_CACHE_KEY } from '@/lib/storageKeys'

/* Every screen reads the same table, so the rows live in one shared store that is
   also kept in localStorage. A page renders straight from the stored copy, then
   checks in the background whether the table has moved on:

   - while the copy is recent, a count-only request — no rows are transferred when
     nothing changed;
   - a full sync when the count differs, the copy is older than FULL_SYNC_MAX_AGE_MS,
     or a write on this device invalidated it.

   Counting, rather than asking for rows after the last date, because the extension
   logs archive puzzles under their own past dates. The periodic full sync catches
   what a count cannot: a CSV re-import on another device that only changes
   existing times. */

export type PuzzleTimesState = {
  stats: PuzzleStats | null
  loading: boolean
  error: string | null
}

type Cache = { userId: string; rows: PuzzleRow[]; fullSyncAt: number }
type StoredCache = { v: 1; userId: string; rows: [string, number][]; fullSyncAt: number }

const PAGE_SIZE = 1000
const FULL_SYNC_MAX_AGE_MS = 12 * 60 * 60 * 1000
const REVALIDATE_THROTTLE_MS = 30 * 1000

const INITIAL_STATE: PuzzleTimesState = { stats: null, loading: true, error: null }

let state = INITIAL_STATE
let cache: Cache | null = null
/** UTC day the current stats were built on, so a tab left open past midnight rebuilds. */
let statsDay = ''
let hydrated = false
let inFlight: Promise<void> | null = null
let lastCheckedAt = 0
/** Bumped by every write on this device, so a sync that raced one runs again. */
let invalidations = 0
/** Bumped on sign-out, so a sync that was already running cannot restore old rows. */
let resets = 0
const listeners = new Set<() => void>()

function setState(next: PuzzleTimesState) {
  state = next
  listeners.forEach(listener => listener())
}

const todayKey = () => toDateKey(getTodayUtc())

function statsFor(rows: PuzzleRow[]): PuzzleStats {
  statsDay = todayKey()
  return buildStats(rows)
}

function rebuildIfNewDay() {
  if (cache && state.stats && statsDay !== todayKey()) {
    setState({ ...state, stats: statsFor(cache.rows) })
  }
}

/** Stored data is user-editable text on disk — take it only if it still has the right shape. */
function readStoredCache(): Cache | null {
  try {
    const raw = window.localStorage.getItem(PUZZLE_TIMES_CACHE_KEY)
    const stored = raw ? (JSON.parse(raw) as Partial<StoredCache>) : null
    if (
      stored?.v !== 1 ||
      typeof stored.userId !== 'string' ||
      typeof stored.fullSyncAt !== 'number' ||
      !Array.isArray(stored.rows) ||
      !stored.rows.every(
        row => Array.isArray(row) && typeof row[0] === 'string' && typeof row[1] === 'number'
      )
    ) {
      return null
    }
    return {
      userId: stored.userId,
      fullSyncAt: stored.fullSyncAt,
      rows: stored.rows.map(([date, time_seconds]) => ({ date, time_seconds })),
    }
  } catch {
    return null
  }
}

function writeStoredCache(next: Cache) {
  const stored: StoredCache = {
    v: 1,
    userId: next.userId,
    rows: next.rows.map(row => [row.date, row.time_seconds]),
    fullSyncAt: next.fullSyncAt,
  }
  try {
    window.localStorage.setItem(PUZZLE_TIMES_CACHE_KEY, JSON.stringify(stored))
  } catch {
    // Private browsing or a full quota — the copy just lasts for this page load.
  }
}

/** Loads the stored copy the first time the store is read, so that first render already has stats. */
function hydrate() {
  if (hydrated || typeof window === 'undefined') return
  hydrated = true
  const stored = readStoredCache()
  if (!stored || stored.userId !== readStoredSession()?.userId) return
  cache = stored
  state = { stats: statsFor(stored.rows), loading: false, error: null }
}

const normalize = (rows: PuzzleRow[]): PuzzleRow[] =>
  rows.map(row => ({ date: row.date.slice(0, 10), time_seconds: row.time_seconds }))

/** Every row the reader can see, oldest first. PostgREST caps each response at the
 *  project's max rows (1,000 by default), so one plain select can come back short. */
export async function fetchAllRows(): Promise<PuzzleRow[]> {
  const page = (from: number, size: number, count?: 'exact') =>
    supabase
      .from('puzzle_times')
      .select('date, time_seconds', { count })
      .order('date', { ascending: true })
      .order('id', { ascending: true })
      .range(from, from + size - 1)

  const first = await page(0, PAGE_SIZE, 'exact')
  if (first.error) throw new Error(first.error.message)
  const rows = (first.data ?? []) as PuzzleRow[]
  // The server may cap pages below PAGE_SIZE; step by what it actually returned.
  const step = rows.length
  const total = first.count ?? step
  if (step === 0 || step >= total) return normalize(rows)

  const offsets: number[] = []
  for (let from = step; from < total; from += step) offsets.push(from)
  const rest = await Promise.all(offsets.map(from => page(from, step)))
  for (const result of rest) {
    if (result.error) throw new Error(result.error.message)
    rows.push(...((result.data ?? []) as PuzzleRow[]))
  }
  return normalize(rows)
}

async function fetchCount(): Promise<number> {
  const { count, error } = await supabase
    .from('puzzle_times')
    .select('*', { count: 'exact', head: true })
  if (error) throw new Error(error.message)
  return count ?? 0
}

const sameRows = (a: PuzzleRow[], b: PuzzleRow[]) =>
  a.length === b.length &&
  a.every((row, i) => row.date === b[i].date && row.time_seconds === b[i].time_seconds)

async function syncOnce() {
  const startedInvalidations = invalidations
  const startedResets = resets

  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession()
  if (sessionError) throw sessionError
  // Signed out: AuthProvider is already on its way to /login.
  if (!session) return

  const userId = session.user.id
  const current = cache?.userId === userId ? cache : null

  if (current && Date.now() - current.fullSyncAt < FULL_SYNC_MAX_AGE_MS) {
    const count = await fetchCount()
    if (resets !== startedResets) return
    if (count === current.rows.length) {
      rebuildIfNewDay()
      return
    }
  }

  const rows = await fetchAllRows()
  if (resets !== startedResets) return

  const kept = current && sameRows(current.rows, rows) ? current.rows : null
  cache = {
    userId,
    rows: kept ?? rows,
    // A write that landed mid-sync may be missing from these rows; leave the copy due.
    fullSyncAt: invalidations === startedInvalidations ? Date.now() : 0,
  }
  writeStoredCache(cache)

  if (kept && state.stats) rebuildIfNewDay()
  else setState({ stats: statsFor(cache.rows), loading: false, error: null })
}

/** Checks the table for changes — at most once per REVALIDATE_THROTTLE_MS unless a write forces it. */
function revalidate(): Promise<void> {
  if (inFlight) return inFlight
  if (Date.now() - lastCheckedAt < REVALIDATE_THROTTLE_MS) {
    rebuildIfNewDay()
    return Promise.resolve()
  }

  inFlight = (async () => {
    try {
      // Go again if a write landed while syncing, so it is never left out.
      let seen: number
      do {
        seen = invalidations
        await syncOnce()
      } while (seen !== invalidations)
    } catch (err) {
      // Keep showing the stored copy; only surface the failure when there is nothing to show.
      if (!state.stats) {
        setState({ stats: null, loading: false, error: err instanceof Error ? err.message : String(err) })
      }
    } finally {
      lastCheckedAt = Date.now()
      inFlight = null
    }
  })()
  return inFlight
}

/** Call after writing to puzzle_times on this device. Resyncs in the background while
 *  the current stats stay on screen. */
export function invalidatePuzzleTimes() {
  hydrate()
  invalidations += 1
  lastCheckedAt = 0
  if (cache) {
    cache = { ...cache, fullSyncAt: 0 }
    // Persisted too, so a reload before the sync lands still resyncs.
    writeStoredCache(cache)
  }
  void revalidate()
}

/** Forgets the stored copy — on sign-out, so the next reader starts clean. */
export function clearPuzzleTimesCache() {
  hydrated = true
  resets += 1
  cache = null
  lastCheckedAt = 0
  try {
    window.localStorage.removeItem(PUZZLE_TIMES_CACHE_KEY)
  } catch {
    // Storage unavailable — nothing was persisted either.
  }
  setState(INITIAL_STATE)
}

/* Coming back to the tab is the moment a solve logged by the extension should show up. */
function onVisibilityChange() {
  if (document.visibilityState === 'visible') void revalidate()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  if (listeners.size === 1) document.addEventListener('visibilitychange', onVisibilityChange)
  return () => {
    listeners.delete(listener)
    if (listeners.size === 0) document.removeEventListener('visibilitychange', onVisibilityChange)
  }
}

function getSnapshot() {
  hydrate()
  return state
}

const getServerSnapshot = () => INITIAL_STATE

export function usePuzzleTimes(): PuzzleTimesState {
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot)

  useEffect(() => {
    void revalidate()
  }, [])

  return snapshot
}
