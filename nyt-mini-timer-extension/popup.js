const puzzleDateEl = document.getElementById('puzzle-date')
const timerEl = document.getElementById('timer-value')
const statusEl = document.getElementById('status')
const refreshBtn = document.getElementById('refresh')
const submitBtn = document.getElementById('submit')
const apiUrlInput = document.getElementById('api-url')
const apiTokenInput = document.getElementById('api-token')
const tokenExpiryEl = document.getElementById('token-expiry')
const saveBtn = document.getElementById('save-settings')
const manualDateInput = document.getElementById('manual-date')
const manualTimeInput = document.getElementById('manual-time')
const historyList = document.getElementById('history-list')

// Bootstrap value only. Set your real endpoint once in the popup's API URL
// field — it persists in chrome.storage.local and never lands in the repo.
// Keep in sync with background.js.
const DEFAULT_API_URL = 'http://localhost:3000/api/auto-log'

const normalizeApiUrl = url => {
  const trimmed = (url || '').trim()
  // Earlier builds stored the host match pattern here; fetch can't use that.
  if (!trimmed || trimmed.includes('*')) return DEFAULT_API_URL
  return trimmed
}

let lastTimer = null
let lastDate = null
let history = []

const sendToBackground = message =>
  new Promise(resolve => {
    chrome.runtime.sendMessage(message, response => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message })
        return
      }
      resolve(response || {})
    })
  })

const syncManualFields = () => {
  if (manualDateInput) manualDateInput.value = lastDate || ''
  if (manualTimeInput) manualTimeInput.value = lastTimer || ''
}

const render = ({ date, timer, status }) => {
  if (date !== undefined) puzzleDateEl.textContent = date ?? '—'
  if (timer !== undefined) timerEl.textContent = timer ?? '—'
  if (status !== undefined) statusEl.textContent = status ?? ''
}

const parseTimerToSeconds = timerText => {
  if (!timerText || typeof timerText !== 'string') return null
  const parts = timerText.trim().split(':')
  if (parts.length !== 2) return null
  const [mm, ss] = parts
  if (!/^\d+$/.test(mm) || !/^\d+$/.test(ss)) return null
  const minutes = parseInt(mm, 10)
  const seconds = parseInt(ss, 10)
  if (Number.isNaN(minutes) || Number.isNaN(seconds)) return null
  return minutes * 60 + seconds
}

const parseJwt = (token) => {
  try {
    const base64Url = token.split('.')[1]
    const base64 = base64Url.replace(/-/g, '+').replace(/_/g, '/')
    return JSON.parse(atob(base64))
  } catch (e) {
    return null
  }
}

const updateTokenExpiry = () => {
  if (!tokenExpiryEl) return
  const token = (apiTokenInput.value || '').trim()
  if (!token) {
    tokenExpiryEl.textContent = ''
    return
  }
  const payload = parseJwt(token)
  if (payload && payload.exp) {
    const expDate = new Date(payload.exp * 1000)
    const now = new Date()
    if (now > expDate) {
      tokenExpiryEl.textContent = 'Token expired!'
      tokenExpiryEl.style.color = '#f8c8c8'
    } else {
      const diffMins = Math.round((expDate - now) / 60000)
      const hours = Math.floor(diffMins / 60)
      const maxMins = diffMins % 60
      const durationStr = hours > 0 ? `${hours}h ${maxMins}m` : `${diffMins}m`
      tokenExpiryEl.textContent = `Expires in ~${durationStr} (${expDate.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })})`
      tokenExpiryEl.style.color = '#c7d8ff'
    }
  } else {
    tokenExpiryEl.textContent = 'Invalid token format'
    tokenExpiryEl.style.color = '#f8c8c8'
  }
}

const getSettings = async () => {
  if (chrome?.storage?.local) {
    return chrome.storage.local.get(['apiUrl', 'apiToken'])
  }
  // Fallback to popup localStorage
  try {
    const apiUrl = localStorage.getItem('nytMiniApiUrl') || null
    const apiToken = localStorage.getItem('nytMiniApiToken') || null
    return { apiUrl, apiToken }
  } catch {
    return {}
  }
}

const setSettings = async ({ apiUrl, apiToken }) => {
  if (chrome?.storage?.local) {
    return chrome.storage.local.set({ apiUrl, apiToken })
  }
  try {
    localStorage.setItem('nytMiniApiUrl', apiUrl || '')
    localStorage.setItem('nytMiniApiToken', apiToken || '')
  } catch {
    // ignore
  }
}

const loadSettings = async () => {
  try {
    const { apiUrl, apiToken } = await getSettings()
    const normalized = normalizeApiUrl(apiUrl)
    apiUrlInput.value = normalized
    apiTokenInput.value = apiToken || ''
    updateTokenExpiry()
    if (normalized !== apiUrl) await setSettings({ apiUrl: normalized, apiToken: apiToken || '' })

    // Ask the worker for a fresh token — it also caches it for auto-logging.
    const { token } = await sendToBackground({ type: 'REFRESH_TOKEN' })
    if (token) {
      apiTokenInput.value = token
      updateTokenExpiry()
    }
  } catch (err) {
    console.warn('NYT Mini Timer: failed to load settings', err)
    apiUrlInput.value = DEFAULT_API_URL
  }
}

const saveSettings = async () => {
  const apiUrl = normalizeApiUrl(apiUrlInput.value)
  const apiToken = (apiTokenInput.value || '').trim()
  apiUrlInput.value = apiUrl
  try {
    await setSettings({ apiUrl, apiToken })
    statusEl.textContent = 'Settings saved.'
  } catch (err) {
    statusEl.textContent = 'Failed to save settings.'
    console.error('NYT Mini Timer: failed to save', err)
  }
}

const getHistory = async () => {
  if (chrome?.storage?.local) {
    const { history: h } = await chrome.storage.local.get(['history'])
    return Array.isArray(h) ? h : []
  }
  try {
    const raw = localStorage.getItem('nytMiniHistory') || '[]'
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

const renderHistory = () => {
  if (!historyList) return
  if (!history || history.length === 0) {
    historyList.textContent = 'No submissions yet.'
    return
  }
  historyList.innerHTML = history
    .slice(0, 10)
    .map(
      entry =>
        `<div style="margin-bottom:6px;"><div>${entry.date || '—'} • ${entry.time || '—'}</div><div style="color:#c7d8ff;">${entry.status || ''}</div></div>`
    )
    .join('')
}

const MINI_URL = /^https:\/\/www\.nytimes\.com\/crosswords\/game\/mini/

const requestTimer = tabId =>
  new Promise(resolve => {
    chrome.tabs.sendMessage(tabId, { type: 'GET_NYT_MINI_TIME' }, response => {
      if (chrome.runtime.lastError) {
        resolve({ error: chrome.runtime.lastError.message || 'Unknown error' })
        return
      }
      resolve(response || {})
    })
  })

const fetchTimer = async () => {
  render({ status: 'Looking for the Mini tab…' })

  let tab
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true })
    tab = tabs[0]
  } catch (err) {
    render({ status: `Unable to read tabs: ${err?.message || err}` })
    return
  }

  if (!tab) {
    render({ status: 'No active tab found.' })
    return
  }

  if (!MINI_URL.test(tab.url || '')) {
    render({ date: null, timer: null, status: 'Open the NYT Mini in this tab, then hit Refresh.' })
    return
  }

  let response = await requestTimer(tab.id)
  if (response.error) {
    // Tab was open before this build of the extension loaded — inject and retry.
    try {
      await chrome.scripting.executeScript({ target: { tabId: tab.id }, files: ['content.js'] })
      response = await requestTimer(tab.id)
    } catch (err) {
      response = { error: `${response.error} (injection failed: ${err?.message || err})` }
    }
  }

  if (response.error) {
    console.warn('NYT Mini Timer: sendMessage error', response.error)
    render({ status: `Could not reach the Mini page — try reloading it. ${response.error}` })
    return
  }

  lastTimer = response.timer ?? null
  lastDate = response.date ?? null
  syncManualFields()
  render({
    date: lastDate || 'Unknown date',
    timer: lastTimer || 'Timer not found',
    status: response.solved
      ? 'Puzzle solved — showing final time.'
      : tab.url
        ? new URL(tab.url).pathname
        : '',
  })
}

const maybeSendToApi = async () => {
  const manualDate = (manualDateInput?.value || '').trim()
  const manualTime = (manualTimeInput?.value || '').trim()
  const effectiveTimer = manualTime || lastTimer
  const effectiveDate = manualDate || lastDate

  if (!effectiveTimer) {
    statusEl.textContent = 'No timer yet. Hit Refresh or enter one manually.'
    return
  }

  const seconds = parseTimerToSeconds(effectiveTimer)
  if (seconds === null) {
    statusEl.textContent = `Cannot parse timer "${effectiveTimer}" (expected mm:ss).`
    return
  }

  // The worker reads settings from storage, so honour a URL or token that was
  // typed here but not saved yet.
  await setSettings({
    apiUrl: normalizeApiUrl(apiUrlInput.value),
    apiToken: (apiTokenInput.value || '').trim(),
  })

  // The worker owns the token lookup and the POST, so a manual submit and an
  // automatic one behave identically.
  statusEl.textContent = 'Sending to API…'
  const result = await sendToBackground({ type: 'SUBMIT_TIME', seconds, date: effectiveDate })
  statusEl.textContent = result.status || result.error || 'No response from the background worker.'

  const { apiToken } = await getSettings()
  if (apiToken) {
    apiTokenInput.value = apiToken
    updateTokenExpiry()
  }
  history = await getHistory()
  renderHistory()
}

refreshBtn.addEventListener('click', fetchTimer)
submitBtn.addEventListener('click', maybeSendToApi)
saveBtn.addEventListener('click', saveSettings)
apiTokenInput.addEventListener('input', updateTokenExpiry)
document.addEventListener('DOMContentLoaded', fetchTimer)
document.addEventListener('DOMContentLoaded', async () => {
  chrome.action.setBadgeText({ text: '' })
  await loadSettings()
  history = await getHistory()
  renderHistory()
  // Opening the popup is a good moment to retry any solve that couldn't be
  // sent at the time (usually because no signed-in tracker tab was open).
  const { pending } = await sendToBackground({ type: 'FLUSH_PENDING' })
  if (pending) {
    statusEl.textContent = `${pending} solve(s) still waiting — sign in to the tracker.`
    history = await getHistory()
    renderHistory()
  }
})
