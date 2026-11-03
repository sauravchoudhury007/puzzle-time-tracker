import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Under jsdom, import.meta.url is an http: URL whose path is relative to the
// vitest root — so join it back onto the root to get a real file path.
const source = readFileSync(
  join(process.cwd(), new URL('./content.js', import.meta.url).pathname),
  'utf8'
)

const todayIso = () => {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`
}

/** Evaluates content.js against the current DOM with a stubbed chrome API.
 *  `solveResponse` stands in for what the background worker replies with. */
const loadContentScript = ({ solveResponse } = {}) => {
  const listeners = []
  const sent = []
  globalThis.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (message, callback) => {
        sent.push(message)
        if (callback) callback(solveResponse)
      },
      onMessage: { addListener: listener => listeners.push(listener) },
    },
  }
  new Function(source)()

  const ask = () => {
    let payload = null
    listeners[0]({ type: 'GET_NYT_MINI_TIME' }, {}, response => {
      payload = response
    })
    return payload
  }
  return { sent, ask }
}

// Mirrors TOAST_KIND in content.js — the discriminator on the worker's reply.
const TOAST_KIND = 'nyt-mini-toast'

const readToast = () => {
  const host = document.getElementById('nyt-mini-timer-toast')
  if (!host) return null
  const root = host.shadowRoot
  return {
    mark: root.querySelector('.mark').textContent,
    heading: root.querySelector('.heading').textContent,
    sub: root.querySelector('.sub').textContent,
  }
}

/** Plays through a solve so the background reply lands and the toast renders. */
const solveWith = solveResponse => {
  document.body.innerHTML = '<div class="timer-count">1:23</div>'
  const loaded = loadContentScript({ solveResponse })
  vi.advanceTimersByTime(1000)
  document.body.innerHTML = CONGRATS
  vi.advanceTimersByTime(1000)
  return loaded
}

const CONGRATS = `
  <div class="xwd__modal--wrapper">
    <div class="xwd__congrats-modal--content">
      <h2>Congratulations!</h2>
      <p>You solved the Mini in 1:23</p>
    </div>
  </div>
`

// Recent Node ships its own `localStorage` global, which is undefined without
// --localstorage-file and shadows jsdom's. content.js uses the bare global.
if (!globalThis.localStorage) {
  const items = new Map()
  Object.defineProperty(globalThis, 'localStorage', {
    configurable: true,
    value: new Proxy(
      {
        getItem: key => (items.has(key) ? items.get(key) : null),
        setItem: (key, value) => items.set(key, String(value)),
        removeItem: key => items.delete(key),
        clear: () => items.clear(),
      },
      // Object.keys(localStorage) lists stored keys, as in a browser.
      { ownKeys: () => [...items.keys()], getOwnPropertyDescriptor: () => ({ enumerable: true, configurable: true }) }
    ),
  })
}

/** Stands in for NYT's puzzle and game-state endpoints. `states` maps a
 *  puzzle id to what the server has saved for it. */
const fakeNyt = ({ puzzleId = 900, states = {} } = {}) => {
  globalThis.fetch = vi.fn(async url => {
    const json = body => ({ ok: true, status: 200, json: async () => body })
    if (url.includes('/svc/crosswords/v6/puzzle/mini/')) return json({ id: puzzleId })
    const ids = /puzzle_ids=(\d+)/.exec(url)
    if (ids) {
      const state = states[ids[1]]
      return json({ states: state ? [{ puzzle_id: ids[1], ...state }] : [] })
    }
    return { ok: false, status: 404, json: async () => ({}) }
  })
  return states
}

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/crosswords/game/mini')
  localStorage.clear()
  fakeNyt()
})

afterEach(() => {
  vi.clearAllTimers()
  vi.useRealTimers()
})

describe('timer reading', () => {
  it('reads the timer from the documented class', () => {
    document.body.innerHTML = '<div class="timer-count">1:23</div>'
    expect(loadContentScript().ask().timer).toBe('1:23')
  })

  it('falls back to other timer-ish classes when NYT renames things', () => {
    document.body.innerHTML = '<span class="xwd__timer--count">0:47</span>'
    expect(loadContentScript().ask().timer).toBe('0:47')
  })

  it('ignores elements that are not a mm:ss reading', () => {
    document.body.innerHTML = '<div class="timer-label">Timer</div>'
    expect(loadContentScript().ask().timer).toBeNull()
  })
})

describe('puzzle date', () => {
  it('uses the date in the URL for archive puzzles', () => {
    window.history.replaceState({}, '', '/crosswords/game/mini/2026/08/04')
    expect(loadContentScript().ask().date).toBe('2026-08-04')
  })

  it('falls back to the date printed on the page for today’s puzzle', () => {
    const today = new Date()
    const printed = today.toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric',
    })
    document.body.innerHTML = `<div class="xwd__details--date">${printed}</div>`
    expect(loadContentScript().ask().date).toBe(todayIso())
  })

  it('ignores an unrelated date far from today', () => {
    document.body.innerHTML = '<div class="article-date">January 3, 1999</div>'
    expect(loadContentScript().ask().date).toBe(todayIso())
  })

  it('falls back to today when the page shows no date at all', () => {
    expect(loadContentScript().ask().date).toBe(todayIso())
  })
})

describe('solve detection', () => {
  it('reports the solve once, with the time from the congrats modal', () => {
    document.body.innerHTML = '<div class="timer-count">1:23</div>'
    const { sent } = loadContentScript()

    vi.advanceTimersByTime(1000)
    expect(sent).toHaveLength(0)

    // NYT swaps the timer out for the congrats dialog.
    document.body.innerHTML = CONGRATS
    vi.advanceTimersByTime(1000)

    expect(sent).toEqual([
      {
        type: 'NYT_MINI_SOLVED',
        seconds: 83,
        date: todayIso(),
        url: window.location.href,
      },
    ])

    vi.advanceTimersByTime(5000)
    expect(sent).toHaveLength(1)
  })

  it('keeps serving the final time after the timer element is gone', () => {
    document.body.innerHTML = '<div class="timer-count">1:23</div>'
    const { ask } = loadContentScript()
    vi.advanceTimersByTime(1000)

    document.body.innerHTML = CONGRATS
    vi.advanceTimersByTime(1000)

    expect(ask()).toMatchObject({ timer: '1:23', solved: true })
  })

  it('prefers the tracked timer when the modal number is clearly not the solve', () => {
    document.body.innerHTML = '<div class="timer-count">0:45</div>'
    const { sent } = loadContentScript()
    vi.advanceTimersByTime(1000)

    document.body.innerHTML = `
      <div class="xwd__congrats-modal--content">
        <h2>Congratulations!</h2>
        <p>Weekly average 5:00</p>
      </div>
    `
    vi.advanceTimersByTime(1000)

    expect(sent[0].seconds).toBe(45)
  })

  it('stays quiet while the puzzle is still in progress', () => {
    document.body.innerHTML = '<div class="timer-count">0:12</div>'
    const { sent } = loadContentScript()
    vi.advanceTimersByTime(10000)
    expect(sent).toHaveLength(0)
  })
})

describe('confirmation toast', () => {
  it('shows the posted time and date, then removes itself', () => {
    solveWith({ kind: TOAST_KIND, ok: true, alreadyLogged: false, time: '1:23', date: '2026-08-04' })

    expect(readToast()).toEqual({ mark: '✓', heading: '1:23 logged', sub: 'Aug 4' })

    // The card is opacity:0 until this class lands, so it must actually apply.
    const card = () =>
      document.getElementById('nyt-mini-timer-toast').shadowRoot.querySelector('.card')
    expect(card().classList.contains('in')).toBe(true)

    // Visible window, then the fade-out.
    vi.advanceTimersByTime(4000)
    expect(readToast()).not.toBeNull()
    vi.advanceTimersByTime(260)
    expect(readToast()).toBeNull()
  })

  it('distinguishes a day that was already on record', () => {
    solveWith({ kind: TOAST_KIND, ok: true, alreadyLogged: true, time: '0:58', date: '2026-08-04' })
    expect(readToast()).toMatchObject({ mark: '✓', heading: '0:58 — already logged' })
  })

  it('reports a failure with the reason instead of a check', () => {
    solveWith({
      kind: TOAST_KIND,
      ok: false,
      alreadyLogged: false,
      time: '2:05',
      date: '2026-08-04',
      detail: 'API 401: Unauthorized',
    })
    expect(readToast()).toEqual({
      mark: '!',
      heading: "Couldn't log 2:05",
      sub: 'API 401: Unauthorized',
    })
  })

  it('reads as pending, not failed, when the solve was queued for retry', () => {
    solveWith({
      kind: TOAST_KIND,
      ok: false,
      queued: true,
      time: '1:23',
      date: '2026-08-04',
      detail: 'No valid token.',
    })
    expect(readToast()).toEqual({
      mark: '⋯',
      heading: '1:23 queued',
      sub: 'Will retry on its own',
    })
  })

  it('dismisses early on click', () => {
    solveWith({ kind: TOAST_KIND, ok: true, alreadyLogged: false, time: '1:23', date: '2026-08-04' })
    document.getElementById('nyt-mini-timer-toast').shadowRoot.querySelector('.card').click()
    vi.advanceTimersByTime(260)
    expect(readToast()).toBeNull()
  })

  it('shows nothing when the worker has nothing to report', () => {
    solveWith(null)
    expect(readToast()).toBeNull()
  })

  it('ignores a reply from an older background build', () => {
    // The pre-toast worker answered {received:true}. Without the discriminator
    // check that rendered as "Couldn't log undefined" while the POST succeeded.
    solveWith({ received: true })
    expect(readToast()).toBeNull()
  })

  it('ignores a well-labelled reply that is missing the time', () => {
    solveWith({ kind: TOAST_KIND, ok: true, alreadyLogged: false })
    expect(readToast()).toBeNull()
  })
})

describe('NYT save guard', () => {
  const SLOT = 'games-state-crossword_mini/42'
  const entry = (puzzleId, printDate, timestamp) => ({
    puzzleId,
    printDate,
    timestamp,
    data: { cells: {}, completionFraction: 0 },
  })
  const slot = () => JSON.parse(localStorage.getItem(SLOT))?.states.map(e => e.puzzleId) ?? null

  const solveArchive = () => {
    window.history.replaceState({}, '', '/crosswords/game/mini/2026/10/21')
    document.body.innerHTML = '<div class="timer-count">1:23</div>'
    loadContentScript()
    vi.advanceTimersByTime(1000)
    document.body.innerHTML = CONGRATS
    vi.advanceTimersByTime(1000)
  }

  it('leaves NYT’s storage alone when NYT saved the solve itself', async () => {
    localStorage.setItem(SLOT, JSON.stringify({ states: [entry('800', '2026-10-20', 100)] }))
    fakeNyt({ states: { 900: { timestamp: 300, game_data: { completionFraction: 1 } }, 800: { timestamp: 200 } } })

    solveArchive()
    await vi.advanceTimersByTimeAsync(30000)

    expect(slot()).toEqual(['800'])
  })

  it('drops another puzzle’s stale copy when it is blocking the save', async () => {
    localStorage.setItem(SLOT, JSON.stringify({ states: [entry('800', '2026-10-20', 100)] }))
    const states = fakeNyt({
      states: { 900: { timestamp: 50, game_data: { completionFraction: 0 } }, 800: { timestamp: 200 } },
    })

    solveArchive()
    await vi.advanceTimersByTimeAsync(4000)
    expect(localStorage.getItem(SLOT)).toBeNull()

    // NYT's queued save goes through once the slot is clear; checking stops.
    states[900] = { timestamp: 400, game_data: { completionFraction: 1 } }
    const calls = fetch.mock.calls.length
    await vi.advanceTimersByTimeAsync(4000)
    await vi.advanceTimersByTimeAsync(30000)
    expect(fetch.mock.calls.length).toBe(calls + 1)
  })

  it('keeps this puzzle’s entry and anything the server has not seen yet', async () => {
    localStorage.setItem(
      SLOT,
      JSON.stringify({
        states: [
          entry('800', '2026-10-20', 100), // superseded on the server
          entry('700', '2026-10-19', 500), // newer than the server: unsynced
          entry('600', '2026-10-18', 100), // server has nothing
          entry('900', '2026-10-21', 100), // this tab's puzzle
        ],
      })
    )
    fakeNyt({ states: { 900: { timestamp: 50, game_data: {} }, 800: { timestamp: 200 }, 700: { timestamp: 300 } } })

    solveArchive()
    await vi.advanceTimersByTimeAsync(4000)

    expect(slot()).toEqual(['700', '600', '900'])
  })

  it('never lets a failing NYT endpoint break solve reporting', async () => {
    globalThis.fetch = vi.fn(async () => {
      throw new Error('offline')
    })
    const { sent } = solveWith({ kind: TOAST_KIND, ok: true, time: '1:23', date: todayIso() })
    expect(readToast().heading).toBe('1:23 logged')
    await vi.advanceTimersByTimeAsync(30000)
    expect(sent).toHaveLength(1)
  })
})

describe('Statsig cache pruning', () => {
  it('keeps the newest five caches and leaves everything else alone', () => {
    for (let i = 0; i < 8; i++) {
      localStorage.setItem(`statsig.cached.evaluations.${i}`, JSON.stringify({ receivedAt: i * 1000, data: 'x' }))
    }
    localStorage.setItem('statsig.cached.evaluations.broken', '{not json')
    localStorage.setItem('statsig.stable_id.1', 'abc')
    localStorage.setItem('games-state-crossword_mini/42', '{"states":[]}')

    loadContentScript()

    expect(Object.keys(localStorage).sort()).toEqual([
      'games-state-crossword_mini/42',
      'statsig.cached.evaluations.3',
      'statsig.cached.evaluations.4',
      'statsig.cached.evaluations.5',
      'statsig.cached.evaluations.6',
      'statsig.cached.evaluations.7',
      'statsig.stable_id.1',
    ])
  })
})
