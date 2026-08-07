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

/** Evaluates content.js against the current DOM with a stubbed chrome API. */
const loadContentScript = () => {
  const listeners = []
  const sent = []
  globalThis.chrome = {
    runtime: {
      lastError: undefined,
      sendMessage: (message, callback) => {
        sent.push(message)
        if (callback) callback()
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

const CONGRATS = `
  <div class="xwd__modal--wrapper">
    <div class="xwd__congrats-modal--content">
      <h2>Congratulations!</h2>
      <p>You solved the Mini in 1:23</p>
    </div>
  </div>
`

beforeEach(() => {
  vi.useFakeTimers()
  document.body.innerHTML = ''
  window.history.replaceState({}, '', '/crosswords/game/mini')
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
