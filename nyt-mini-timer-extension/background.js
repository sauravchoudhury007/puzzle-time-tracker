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

const readTokenFromTrackerTab = async () => {
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

const isExpired = token => {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')))
    // 30s of slack so we don't send a token that dies in flight.
    return typeof payload?.exp === 'number' && payload.exp * 1000 < Date.now() + 30000
  } catch {
    return false
  }
}

// A live tab always wins: the stored copy is a cache and Supabase tokens are short-lived.
const resolveToken = async () => {
  const fresh = await readTokenFromTrackerTab()
  if (fresh) {
    const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
    await chrome.storage.local.set({ apiUrl: normalizeApiUrl(apiUrl), apiToken: fresh })
    return fresh
  }
  const { apiToken } = await chrome.storage.local.get(['apiToken'])
  if (apiToken && !isExpired(apiToken)) return apiToken
  if (apiToken) console.warn('NYT Mini Timer: stored token is expired')
  return null
}

const recordHistory = async entry => {
  const { history } = await chrome.storage.local.get(['history'])
  const next = [entry, ...(Array.isArray(history) ? history : [])].slice(0, 10)
  await chrome.storage.local.set({ history: next })
}

/** Posts one time to the tracker. `ok` covers both a fresh insert and
 *  'already_logged' — either way the day is on record. Returns { ok, status }. */
const submitTime = async ({ seconds, date, source = 'manual' }) => {
  if (typeof seconds !== 'number' || !Number.isFinite(seconds) || seconds <= 0) {
    return { ok: false, status: 'Invalid time.' }
  }

  const token = await resolveToken()
  if (!token) {
    return {
      ok: false,
      status: 'No valid token. Open the tracker site in a tab and sign in.',
    }
  }

  const { apiUrl } = await chrome.storage.local.get(['apiUrl'])
  const endpoint = normalizeApiUrl(apiUrl)
  const payloadDate = /^\d{4}-\d{2}-\d{2}$/.test(date || '') ? date : undefined

  let status
  let ok = false
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
    ok = res.ok
    status = res.ok
      ? `API ok: ${body?.status || 'success'}`
      : `API ${res.status}: ${body?.error || 'failed'}`
  } catch (err) {
    status = `API error: ${err?.message || err}`
  }

  await recordHistory({
    date: payloadDate || date || '—',
    time: formatSeconds(Math.round(seconds)),
    status,
    source,
  })
  return { ok, status }
}

const getPending = async () => {
  const { pending } = await chrome.storage.local.get(['pending'])
  return Array.isArray(pending) ? pending : []
}

const handleSolved = async ({ seconds, date }) => {
  const { autoLogged } = await chrome.storage.local.get(['autoLogged'])
  const logged = autoLogged && typeof autoLogged === 'object' ? autoLogged : {}
  if (logged[date]) return

  const result = await submitTime({ seconds, date, source: 'auto' })
  if (result.ok) {
    // Keep only recent dates so this map doesn't grow forever.
    const dates = Object.keys(logged).concat(date).sort().slice(-30)
    const next = {}
    for (const key of dates) next[key] = true
    await chrome.storage.local.set({ autoLogged: next })
    await chrome.storage.local.set({ pending: (await getPending()).filter(p => p.date !== date) })
    setBadge('✓', '#16a34a')
    return
  }

  // Usually a missing/expired token — hold it and retry when the tracker is open.
  const pending = (await getPending()).filter(p => p.date !== date)
  await chrome.storage.local.set({
    pending: [...pending, { seconds, date, at: Date.now() }].slice(-10),
  })
  setBadge('!', '#dc2626')
  console.warn('NYT Mini Timer: solve queued for retry', date, result.status)
}

let flushing = false

const flushPending = async () => {
  if (flushing) return
  flushing = true
  try {
    const pending = await getPending()
    if (pending.length === 0) return
    // Without a token every retry fails and just fills history with noise.
    if (!(await resolveToken())) return
    const remaining = []
    let anyLogged = false
    for (const entry of pending) {
      const result = await submitTime({ ...entry, source: 'auto-retry' })
      if (result.ok) anyLogged = true
      else remaining.push(entry)
    }
    await chrome.storage.local.set({ pending: remaining })
    if (anyLogged && remaining.length === 0) setBadge('✓', '#16a34a')
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
    return reply(
      async () => {
        await handleSolved(message)
        return { received: true }
      },
      sendResponse,
      () => ({ received: false })
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
    return reply(
      async () => ({ token: await resolveToken() }),
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

// Retry queued solves as soon as a signed-in tracker tab shows up.
chrome.tabs.onUpdated.addListener((_tabId, changeInfo, tab) => {
  if (changeInfo.status !== 'complete' || !tab.url) return
  if (!/^https?:\/\/(localhost:3000|[^/]*\.mr007\.ca)\//.test(tab.url)) return
  flushPending()
})
