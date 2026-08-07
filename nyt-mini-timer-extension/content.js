/* Runs on the NYT Mini page. Watches the on-page timer so we still know the
 * final time after NYT tears the timer down on solve, works out which puzzle
 * date is on screen, and tells the background worker when the puzzle is done.
 */

const POLL_MS = 1000

// NYT renames these classes now and then, so try the known ones and fall back
// to anything timer-ish that reads as mm:ss.
const TIMER_SELECTORS = [
  '.timer-count',
  '.xwd__timer--count',
  '[class*="timer-count"]',
  '[class*="timer--count"]',
]

const EXACT_TIME = /^(\d{1,3}):([0-5]\d)$/
const ANY_TIME = /(\d{1,3}):([0-5]\d)/
const SOLVED_TEXT = /congratulations|you solved|solved it|nice work|great job/i

const state = {
  url: location.href,
  timerText: null,
  seconds: null,
  solved: false,
  reportedDate: null,
}

const toSeconds = (match) => parseInt(match[1], 10) * 60 + parseInt(match[2], 10)

const parseExactTime = text => {
  const match = EXACT_TIME.exec((text || '').trim())
  return match ? toSeconds(match) : null
}

const findTimeInText = text => {
  const match = ANY_TIME.exec(text || '')
  return match ? toSeconds(match) : null
}

const formatSeconds = seconds =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const readTimerText = () => {
  for (const selector of TIMER_SELECTORS) {
    for (const el of document.querySelectorAll(selector)) {
      const text = el.textContent?.trim() || ''
      if (parseExactTime(text) !== null) return text
    }
  }
  for (const el of document.querySelectorAll('[class*="timer" i]')) {
    const text = el.textContent?.trim() || ''
    if (parseExactTime(text) !== null) return text
  }
  return null
}

// The congrats dialog: smallest element that reads like a solve confirmation,
// so we get the message itself rather than a wrapper around half the page.
const findSolvedModal = () => {
  let best = null
  const candidates = document.querySelectorAll(
    '[class*="congrats" i], [class*="modal" i], [role="dialog"]'
  )
  for (const el of candidates) {
    const text = el.textContent || ''
    if (!SOLVED_TEXT.test(text)) continue
    if (!best || text.length < (best.textContent || '').length) best = el
  }
  return best
}

const localDateIso = (date = new Date()) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

const dateFromPath = () => {
  const match = location.pathname.match(/\/game\/mini\/(\d{4})\/(\d{2})\/(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

// Today's Mini has no date in the URL, so read the date NYT prints on the page.
// Tomorrow's puzzle unlocks at 10pm ET, so anything outside ±1 day is not ours.
const dateFromPage = () => {
  const now = Date.now()
  for (const el of document.querySelectorAll('[class*="date" i]')) {
    const match = (el.textContent || '').match(/([A-Z][a-z]+)\s+(\d{1,2}),\s*(\d{4})/)
    if (!match) continue
    const parsed = new Date(`${match[1]} ${match[2]}, ${match[3]}`)
    if (Number.isNaN(parsed.getTime())) continue
    if (Math.abs(parsed.getTime() - now) > 2 * 24 * 60 * 60 * 1000) continue
    return localDateIso(parsed)
  }
  return null
}

const getPuzzleDate = () => dateFromPath() || dateFromPage() || localDateIso()

const notifySolved = (seconds, date) => {
  try {
    chrome.runtime.sendMessage(
      { type: 'NYT_MINI_SOLVED', seconds, date, url: location.href },
      () => void chrome.runtime.lastError
    )
  } catch (err) {
    console.warn('[NYT Mini Timer] could not report solve', err)
  }
}

const resetForNewPuzzle = () => {
  state.url = location.href
  state.timerText = null
  state.seconds = null
  state.solved = false
  state.reportedDate = null
}

const tick = () => {
  // The crossword app is a SPA — moving between puzzles never reloads us.
  if (location.href !== state.url) resetForNewPuzzle()

  const text = readTimerText()
  if (text) {
    const seconds = parseExactTime(text)
    // Only move forward: a restarted/blank timer shouldn't clobber the real time.
    if (seconds !== null && (state.seconds === null || seconds >= state.seconds)) {
      state.timerText = text
      state.seconds = seconds
    }
  }

  const modal = findSolvedModal()
  if (!modal) return

  const modalSeconds = findTimeInText(modal.textContent)
  // The modal time is exact; our polled time can lag by a second. Trust the
  // modal when the two agree, and our own tracking when they clearly don't
  // (that number probably belongs to a streak or stats line, not the solve).
  let seconds = state.seconds
  if (modalSeconds !== null) {
    if (seconds === null || Math.abs(modalSeconds - seconds) <= 5) seconds = modalSeconds
  }
  if (seconds === null || seconds <= 0) return

  const date = getPuzzleDate()
  if (state.solved && state.reportedDate === date) return

  state.solved = true
  state.reportedDate = date
  state.seconds = seconds
  state.timerText = formatSeconds(seconds)
  console.debug('[NYT Mini Timer] solved', { seconds, date })
  notifySolved(seconds, date)
}

const timer = setInterval(() => {
  try {
    tick()
  } catch (err) {
    // Reloading the extension invalidates this script's context; stop cleanly.
    if (String(err?.message || err).includes('Extension context invalidated')) {
      clearInterval(timer)
      return
    }
    console.warn('[NYT Mini Timer] tick failed', err)
  }
}, POLL_MS)

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_NYT_MINI_TIME') {
    // Prefer what's on screen; fall back to the last value we saw, which is
    // what's left once NYT removes the timer on solve.
    const payload = {
      timer: readTimerText() || state.timerText,
      date: getPuzzleDate(),
      solved: state.solved,
      url: location.href,
    }
    console.debug('[NYT Mini Timer] responding with timer/date', payload)
    sendResponse(payload)
  }
})
