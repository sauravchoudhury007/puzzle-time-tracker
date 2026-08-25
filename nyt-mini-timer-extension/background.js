/* Background worker: owns the token lookup and every POST to the tracker API,
 * so the popup's Submit button and an automatic solve take the same path.
 */

// Bootstrap value only. Set your real endpoint once in the popup's API URL
// field — it persists in chrome.storage.local and never lands in the repo.
// Keep in sync with popup.js.
const DEFAULT_API_URL = 'http://localhost:3000/api/auto-log'
const TRACKER_URLS = ['http://localhost:3000/*', 'https://*.mr007.ca/*']

const normalizeApiUrl = url => {
  const trimmed = (url || '').trim()
  // Earlier builds stored the host match pattern here; fetch can't use that.
  if (!trimmed || trimmed.includes('*')) return DEFAULT_API_URL
  return trimmed
}

const formatSeconds = seconds =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`

const setBadge = (text, color) => {
  chrome.action.setBadgeText({ text })
  if (text) chrome.action.setBadgeBackgroundColor({ color })
}

// A discarded tab can make executeScript reload the whole page, so cap how long
// the slow path is allowed to hold up a solve.
const TAB_TOKEN_TIMEOUT_MS = 4000

const withTimeout = (promise, ms, fallback = null) =>
  Promise.race([promise, new Promise(resolve => setTimeout(() => resolve(fallback), ms))])

const readTokenFromTrackerTabUncapped = async () => {
  let tabs = []
  try {
    tabs = await chrome.tabs.query({ url: TRACKER_URLS })
  } catch (err) {
    console.warn('NYT Mini Timer: tab query failed', err)
    return null
  }

  for (const tab of tabs) {
    const fromMessage = await new Promise(resolve => {
      chrome.tabs.sendMessage(tab.id, { type: 'GET_SUPABASE_TOKEN' }, response => {
        if (chrome.runtime.lastError) {
          resolve(null)
          return
        }
        resolve(response?.token || null)
      })
    })
    if (fromMessage) return fromMessage

    // Content script may not be injected yet (e.g. tab restored from a session).
    if (!chrome.scripting?.executeScript) continue
    try {
      const [{ result }] = await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        func: () => {
          const key = Object.keys(localStorage).find(k => /^sb-.*-auth-token$/.test(k))
          if (!key) return null
          const raw = localStorage.getItem(key) || ''
          try {
            const parsed = JSON.parse(raw)
            return parsed.access_token || parsed?.currentSession?.access_token || null
          } catch {
            if (typeof raw === 'string' && raw.startsWith('eyJ')) return raw
            return null
          }
        },
      })
      if (result) return result
    } catch (err) {
      console.warn('NYT Mini Timer: token injection failed', err)
    }
  }

  return null
}

const readTokenFromTrackerTab = () =>
  withTimeout(readTokenFromTrackerTabUncapped(), TAB_TOKEN_TIMEOUT_MS)

const isExpired = token => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    // A minute of slack so we don't send a token that dies in flight.
    return typeof payload?.exp === 'number' && payload.exp * 1000 < Date.now() + 60000
  } catch {
    return false
  }
}

/** The cached token is authoritative while its own `exp` says it's alive, so the
 *  common path is a single storage read and no tab work at all. Only go hunting
 *  through tracker tabs when there's nothing usable cached — that path can stall
 *  for seconds if Chrome has discarded the tab. `forceFresh` is for retrying a
 *  401, where the cached token was accepted as unexpired but rejected anyway. */
const resolveToken = async ({ forceFresh = false } = {}) => {
  const { apiToken } = await chrome.storage.local.get(['apiToken'])
  const cachedIsGood = Boolean(apiToken) && !isExpired(apiToken)
  if (cachedIsGood && !forceFresh) return apiToken

  const fresh = await readTokenFromTrackerTab()
  if (fresh) {
    const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
    await chrome.storage.local.set({ apiUrl: normalizeApiUrl(apiUrl), apiToken: fresh })
    return fresh
  }
  // No tracker tab could help; the cached token is still the best we have.
  if (cachedIsGood) return apiToken
  if (apiToken) console.warn('NYT Mini Timer: stored token is expired')
  return null
}

const recordHistory = async entry => {
  const { history } = await chrome.storage.local.get(['history'])
  const next = [entry, ...(Array.isArray(history) ? history : [])].slice(0, 10)
  await chrome.storage.local.set({ history: next })
}

const postTime = async (endpoint, token, seconds, payloadDate) => {
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ seconds, date: payloadDate }),
    })
    const body = await res.json().catch(() => null)
    return {
      ok: res.ok,
      unauthorized: res.status === 401,
      result: body?.status ?? null,
      status: res.ok
        ? `API ok: ${body?.status || 'success'}`
        : `API ${res.status}: ${body?.error || 'failed'}`,
    }
  } catch (err) {
    return { ok: false, unauthorized: false, result: null, status: `API error: ${err?.message || err}` }
  }
}

/** Posts one time to the tracker. `ok` covers both a fresh insert and
 *  'already_logged' — either way the day is on record. Returns { ok, status }. */
const submitTime = async ({ seconds, date, source = 'manual' }) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, status: 'Invalid time.' }
  }

  const started = Date.now()
  const token = await resolveToken()
  if (!token) {
    return {
      ok: false,
      status: 'No valid token. Open the tracker site in a tab and sign in.',
    }
  }
  const tokenMs = Date.now() - started

  const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
  const endpoint = normalizeApiUrl(apiUrl)
  const payloadDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : undefined

  let attempt = await postTime(endpoint, token, seconds, payloadDate)
  // The cached token passed its own expiry check but the server still refused it
  // (signed out elsewhere, session revoked). One forced refresh covers that.
  if (attempt.unauthorized) {
    const refreshed = await resolveToken({ forceFresh: true })
    if (refreshed && refreshed !== token) {
      attempt = await postTime(endpoint, refreshed, seconds, payloadDate)
    }
  }

  console.debug(
    `NYT Mini Timer: ${source} submit — token ${tokenMs}ms, total ${Date.now() - started}ms — ${attempt.status}`
  )

  await recordHistory({
    date: payloadDate || date || '—',
    time: formatSeconds(Math.round(seconds)),
    status: attempt.status,
    source,
  })
  return { ok: attempt.ok, status: attempt.status, result: attempt.result }
}

const getPending = async () => {
  const { pending } = await chrome.storage.local.get(['pending'])
  return Array.isArray(pending) ? pending : []
}

const RETRY_ALARM = 'nyt-mini-retry'
const RETRY_PERIOD_MINUTES = 1
// Roughly 20 minutes of trying. Past that something needs a human, and we stop
// so a tracker tab that can't produce a token isn't woken on a loop forever.
const MAX_RETRY_ATTEMPTS = 20

/** Keeps a repeating alarm alive exactly while there's work worth retrying, so
 *  a queued solve completes on its own instead of waiting for the popup. */
const syncRetryAlarm = async () => {
  const pending = await getPending()
  const worthRetrying = pending.some(entry => (entry.attempts || 0) < MAX_RETRY_ATTEMPTS)
  if (!worthRetrying) {
    await chrome.alarms.clear(RETRY_ALARM)
    return
  }
  // Only create when absent — recreating would reset the countdown each time.
  const existing = await chrome.alarms.get(RETRY_ALARM)
  if (!existing) {
    chrome.alarms.create(RETRY_ALARM, {
      delayInMinutes: RETRY_PERIOD_MINUTES,
      periodInMinutes: RETRY_PERIOD_MINUTES,
    })
  }
}

/** Logs a finished puzzle. Returns the toast payload for the page to show,
 *  or null when there's nothing new to say. */
const handleSolved = async ({ seconds, date }) => {
  const { autoLogged } = await chrome.storage.local.get(['autoLogged'])
  const logged = autoLogged && typeof autoLogged === 'object' ? autoLogged : {}
  // Already handled this date — stay silent rather than re-toasting on reload.
  if (logged[date]) return null

  const result = await submitTime({ seconds, date, source: 'auto' })
  const toast = {
    // Discriminator — content.js renders nothing without it, so a stale worker
    // replying in some older shape can't paint a nonsense toast. Keep in sync
    // with TOAST_KIND in content.js.
    kind: 'nyt-mini-toast',
    ok: result.ok,
    alreadyLogged: result.result === 'already_logged',
    time: formatSeconds(Math.round(seconds)),
    date,
    detail: result.status,
  }

  if (result.ok) {
    // Keep only recent dates so this map doesn't grow forever.
    const dates = Object.keys(logged).concat(date).sort().slice(-30)
    const next = {}
    for (const key of dates) next[key] = true
    await chrome.storage.local.set({ autoLogged: next })
    await chrome.storage.local.set({ pending: (await getPending()).filter(p => p.date !== date) })
    // The toast is the success signal; a badge would just linger.
    setBadge('')
    return toast
  }

  // Usually a missing/expired token. Queue it and let the retry alarm finish the
  // job — this must not depend on the user opening the popup.
  const pending = (await getPending()).filter(p => p.date !== date)
  await chrome.storage.local.set({
    pending: [...pending, { seconds, date, at: Date.now(), attempts: 0 }].slice(-10),
  })
  await syncRetryAlarm()
  // A failure is unresolved work, so this badge is meant to stick around.
  setBadge('!', '#dc2626')
  console.warn('NYT Mini Timer: solve queued for retry', date, result.status)
  return { ...toast, queued: true }
}

let flushing = false

const flushPending = async () => {
  if (flushing) return
  flushing = true
  try {
    const pending = await getPending()
    if (pending.length === 0) {
      await syncRetryAlarm()
      return
    }

    // Without a token every retry fails and just fills history with noise. Still
    // count the attempt so an unresolvable queue eventually stops waking things.
    if (!(await resolveToken())) {
      await chrome.storage.local.set({
        pending: pending.map(entry => ({ ...entry, attempts: (entry.attempts || 0) + 1 })),
      })
      await syncRetryAlarm()
      return
    }

    const remaining = []
    let anyLogged = false
    for (const entry of pending) {
      const result = await submitTime({ ...entry, source: 'auto-retry' })
      if (result.ok) anyLogged = true
      else remaining.push({ ...entry, attempts: (entry.attempts || 0) + 1 })
    }
    await chrome.storage.local.set({ pending: remaining })
    // Nothing left to chase — drop the warning badge.
    if (anyLogged && remaining.length === 0) setBadge('')
    await syncRetryAlarm()
  } finally {
    flushing = false
  }
}

// Always answer, even on failure — the popup waits on these replies.
const reply = (work, sendResponse, onError) => {
  Promise.resolve()
    .then(work)
    .then(sendResponse)
    .catch(err => {
      console.warn('NYT Mini Timer: handler failed', err)
      sendResponse(onError(err))
    })
  return true
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'NYT_MINI_SOLVED') {
    // The reply is the toast payload — the page shows it once we know the result.
    return reply(
      () => handleSolved(message),
      sendResponse,
      () => null
    )
  }

  if (message?.type === 'SUBMIT_TIME') {
    return reply(
      () => submitTime({ seconds: message.seconds, date: message.date, source: 'manual' }),
      sendResponse,
      err => ({ ok: false, status: `Extension error: ${err?.message || err}` })
    )
  }

  if (message?.type === 'REFRESH_TOKEN') {
    // Opening the popup is an explicit "check on things", and it doubles as a
    // way to warm the cache, so this one does go to the tab.
    return reply(
      async () => ({ token: await resolveToken({ forceFresh: true }) }),
      sendResponse,
      () => ({ token: null })
    )
  }

  if (message?.type === 'FLUSH_PENDING') {
    return reply(
      async () => {
        await flushPending()
        return { pending: (await getPending()).length }
      },
      sendResponse,
      () => ({ pending: 0 })
    )
  }

  return false
})

// A tracker tab just finished loading, so it's definitely awake. Grab a fresh
// token now while it's cheap — that keeps the cache warm so a later solve is a
// storage read plus one POST, instead of going tab-hunting mid-puzzle.
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return
  if (!/^https?:\/\/(localhost:3000|[^/]*\.mr007\.ca)\//.test(tab.url)) return
  resolveToken({ forceFresh: true })
    .then(flushPending)
    .catch(err => console.warn('NYT Mini Timer: token warm-up failed', err))
})

// The whole point of the queue: it drains itself, with nothing to click.
chrome.alarms.onAlarm.addListener(alarm => {
  if (alarm.name !== RETRY_ALARM) return
  flushPending().catch(err => console.warn('NYT Mini Timer: retry failed', err))
})

// Alarms are dropped when the extension reloads, and a queued solve should
// still survive a browser restart, so re-establish on both.
chrome.runtime.onInstalled.addListener(() => {
  syncRetryAlarm().catch(() => {})
})

chrome.runtime.onStartup.addListener(() => {
  flushPending().catch(() => {})
})
