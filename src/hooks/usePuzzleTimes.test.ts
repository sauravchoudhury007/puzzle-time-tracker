import { act, renderHook, waitFor } from '@testing-library/react'
import { vi } from 'vitest'
import { PUZZLE_TIMES_CACHE_KEY } from '@/lib/storageKeys'

type Row = { date: string; time_seconds: number }

const HOUR = 60 * 60 * 1000

/* A stand-in for the puzzle_times table behind PostgREST, just big enough for the
   store: count-only requests, ranged selects, and a max-rows cap per response. */
const db = vi.hoisted(() => {
  const state = {
    rows: [] as { date: string; time_seconds: number }[],
    /** PostgREST's max rows: no response carries more than this. */
    maxRows: 1000,
    sessionUserId: 'user-1' as string | null,
    storedUserId: 'user-1' as string | null,
    /** Every request in order: 'count', or 'rows@<offset>'. */
    requests: [] as string[],
    /** While set, getSession waits on it — a slow token refresh. */
    sessionGate: null as Promise<void> | null,
    offline: false,
  }

  class Query {
    private head = false
    private count: string | undefined
    private from = 0
    private to = Number.POSITIVE_INFINITY

    select(_columns: string, options?: { count?: string; head?: boolean }) {
      this.head = Boolean(options?.head)
      this.count = options?.count
      return this
    }

    order() {
      return this
    }

    range(from: number, to: number) {
      this.from = from
      this.to = to
      return this
    }

    then<T>(resolve: (value: unknown) => T, reject?: (reason: unknown) => T) {
      state.requests.push(this.head ? 'count' : `rows@${this.from}`)
      const count = this.count === 'exact' ? state.rows.length : null
      const result = state.offline
        ? { data: null, count: null, error: { message: 'offline' } }
        : this.head
          ? { data: null, count, error: null }
          : {
              data: state.rows.slice(this.from, Math.min(this.to + 1, this.from + state.maxRows)),
              count,
              error: null,
            }
      return Promise.resolve(result).then(resolve, reject)
    }
  }

  return { state, Query }
})

vi.mock('@/lib/supabaseClient', () => ({
  readStoredSession: () => (db.state.storedUserId ? { userId: db.state.storedUserId } : null),
  supabase: {
    auth: {
      getSession: async () => {
        if (db.state.sessionGate) await db.state.sessionGate
        const session = db.state.sessionUserId ? { user: { id: db.state.sessionUserId } } : null
        return { data: { session }, error: null }
      },
    },
    from: () => new db.Query(),
  },
}))

/** `n` consecutive solved days from 2015-01-01, all well before today. */
function makeRows(n: number, seconds = 60): Row[] {
  const start = Date.UTC(2015, 0, 1)
  return Array.from({ length: n }, (_, i) => ({
    date: new Date(start + i * 24 * HOUR).toISOString().slice(0, 10),
    time_seconds: seconds,
  }))
}

function storeCopy(rows: Row[], { userId = 'user-1', fullSyncAt = Date.now() } = {}) {
  window.localStorage.setItem(
    PUZZLE_TIMES_CACHE_KEY,
    JSON.stringify({ v: 1, userId, rows: rows.map(r => [r.date, r.time_seconds]), fullSyncAt })
  )
}

function storedCopy() {
  const raw = window.localStorage.getItem(PUZZLE_TIMES_CACHE_KEY)
  return raw ? JSON.parse(raw) : null
}

/** The store lives at module scope, so every test gets a fresh copy of the module. */
async function loadStore() {
  vi.resetModules()
  return import('./usePuzzleTimes')
}

const settle = () => new Promise(resolve => setTimeout(resolve, 0))

/** This suite also runs extension tests, which leave a partial localStorage behind. */
function installMemoryStorage() {
  const store = new Map<string, string>()
  Object.defineProperty(window, 'localStorage', {
    configurable: true,
    value: {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, String(v)),
      removeItem: (k: string) => void store.delete(k),
      clear: () => store.clear(),
      key: (i: number) => [...store.keys()][i] ?? null,
      get length() {
        return store.size
      },
    },
  })
}

beforeEach(() => {
  installMemoryStorage()
  Object.assign(db.state, {
    rows: [],
    maxRows: 1000,
    sessionUserId: 'user-1',
    storedUserId: 'user-1',
    requests: [],
    sessionGate: null,
    offline: false,
  })
})

describe('usePuzzleTimes', () => {
  it('renders the stored copy before any request resolves', async () => {
    storeCopy(makeRows(3))
    db.state.rows = makeRows(3)
    let release!: () => void
    db.state.sessionGate = new Promise(resolve => {
      release = resolve
    })

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    expect(result.current.loading).toBe(false)
    expect(result.current.stats?.solvedCount).toBe(3)
    expect(db.state.requests).toEqual([])

    release()
    await waitFor(() => expect(db.state.requests).toEqual(['count']))
  })

  it('transfers no rows when the count still matches', async () => {
    storeCopy(makeRows(3))
    db.state.rows = makeRows(3)

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())
    const initialStats = result.current.stats

    await waitFor(() => expect(db.state.requests).toEqual(['count']))
    await settle()
    expect(db.state.requests).toEqual(['count'])
    expect(result.current.stats).toBe(initialStats)
  })

  it('fetches and stores the rows when the count differs', async () => {
    storeCopy(makeRows(3), { fullSyncAt: Date.now() - HOUR })
    db.state.rows = makeRows(4)

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(result.current.stats?.solvedCount).toBe(4))
    expect(db.state.requests).toEqual(['count', 'rows@0'])
    expect(storedCopy().rows).toHaveLength(4)
    expect(storedCopy().fullSyncAt).toBeGreaterThan(Date.now() - 5000)
  })

  it('ignores a stored copy that belongs to another account', async () => {
    storeCopy(makeRows(3), { userId: 'someone-else' })
    db.state.rows = makeRows(5)

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    expect(result.current.stats).toBeNull()
    expect(result.current.loading).toBe(true)
    await waitFor(() => expect(result.current.stats?.solvedCount).toBe(5))
    expect(db.state.requests).toEqual(['rows@0'])
    expect(storedCopy().userId).toBe('user-1')
  })

  it('does a full sync without counting once the copy is over 12 hours old', async () => {
    storeCopy(makeRows(3), { fullSyncAt: Date.now() - 13 * HOUR })
    db.state.rows = makeRows(3)

    const { usePuzzleTimes } = await loadStore()
    renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(storedCopy().fullSyncAt).toBeGreaterThan(Date.now() - 5000))
    expect(db.state.requests).toEqual(['rows@0'])
  })

  it('fetches every page when the table outgrows one response', async () => {
    db.state.rows = makeRows(2500)

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(result.current.stats?.solvedCount).toBe(2500))
    expect(db.state.requests).toEqual(['rows@0', 'rows@1000', 'rows@2000'])
  })

  it('pages by what the server returns when its cap is below the page size', async () => {
    db.state.rows = makeRows(1000)
    db.state.maxRows = 400

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(result.current.stats?.solvedCount).toBe(1000))
    expect(db.state.requests).toEqual(['rows@0', 'rows@400', 'rows@800'])
  })

  it('resyncs after a write while the old stats stay on screen', async () => {
    storeCopy(makeRows(3))
    db.state.rows = makeRows(3)

    const { usePuzzleTimes, invalidatePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())
    await waitFor(() => expect(db.state.requests).toEqual(['count']))

    // A re-import that only changes existing times: the count alone would miss it.
    db.state.rows = makeRows(3, 45)
    act(() => invalidatePuzzleTimes())

    expect(result.current.stats?.best).toBe(60)
    expect(storedCopy().fullSyncAt).toBe(0)
    await waitFor(() => expect(result.current.stats?.best).toBe(45))
    expect(db.state.requests).toEqual(['count', 'rows@0'])
  })

  it('forgets the stored copy on clear, even with a sync under way', async () => {
    storeCopy(makeRows(3))
    db.state.rows = makeRows(3)

    const { usePuzzleTimes, clearPuzzleTimesCache } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())
    act(() => clearPuzzleTimesCache())

    expect(storedCopy()).toBeNull()
    expect(result.current.stats).toBeNull()
    await waitFor(() => expect(db.state.requests).toEqual(['rows@0']))
    await settle()
    expect(storedCopy()).toBeNull()
    expect(result.current.stats).toBeNull()
  })

  it('keeps the stored copy on screen when a check fails', async () => {
    storeCopy(makeRows(3))
    db.state.rows = makeRows(3)
    db.state.offline = true

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(db.state.requests).toEqual(['count']))
    await settle()
    expect(result.current.stats?.solvedCount).toBe(3)
    expect(result.current.error).toBeNull()
  })

  it('reports the failure when there is nothing stored to show', async () => {
    db.state.offline = true

    const { usePuzzleTimes } = await loadStore()
    const { result } = renderHook(() => usePuzzleTimes())

    await waitFor(() => expect(result.current.error).toBe('offline'))
    expect(result.current.loading).toBe(false)
  })
})
