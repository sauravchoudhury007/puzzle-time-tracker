const puzzleDateEl = document.getElementById('puzzle-date')
const timerEl = document.getElementById('timer-value')
const statusEl = document.getElementById('status')
const refreshBtn = document.getElementById('refresh')
const submitBtn = document.getElementById('submit')
const apiUrlInput = document.getElementById('api-url')
const apiTokenInput = document.getElementById('api-token')
const saveBtn = document.getElementById('save-settings')
const manualDateInput = document.getElementById('manual-date')
const manualTimeInput = document.getElementById('manual-time')
const historyList = document.getElementById('history-list')

const DEFAULT_API_URL = 'https://*.mr007.live/api/auto-log'
let lastTimer = null
let lastDate = null
let history = []

const syncManualFields = () => {
  if (manualDateInput) manualDateInput.value = lastDate || ''
  if (manualTimeInput) manualTimeInput.value = lastTimer || ''
}

const render = ({ date, timer, status }) => {
  puzzleDateEl.textContent = date ?? '—'
  timerEl.textContent = timer ?? '—'
  statusEl.textContent = status ?? ''
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
    apiUrlInput.value = apiUrl || DEFAULT_API_URL
    apiTokenInput.value = apiToken || ''
  } catch (err) {
    console.warn('NYT Mini Timer: failed to load settings', err)
    apiUrlInput.value = DEFAULT_API_URL
  }
}

const saveSettings = async () => {
  const apiUrl = (apiUrlInput.value || '').trim() || DEFAULT_API_URL
  const apiToken = (apiTokenInput.value || '').trim()
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

const setHistory = async next => {
  history = next
  renderHistory()
  if (chrome?.storage?.local) {
    return chrome.storage.local.set({ history: next })
  }
  try {
    localStorage.setItem('nytMiniHistory', JSON.stringify(next))
  } catch {
    // ignore
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

  chrome.tabs.sendMessage(
    tab.id,
    { type: 'GET_NYT_MINI_TIME' },
    response => {
      if (chrome.runtime.lastError) {
        const msg = chrome.runtime.lastError.message || 'Unknown error'
        console.warn('NYT Mini Timer: sendMessage error', msg)
        render({
          status: `Not on a NYT Mini page (or script not injected). ${msg}`,
        })
        return
      }

      const timer = response?.timer ?? null
      const date = response?.date ?? null
      const url = response?.url ?? tab.url

      lastTimer = timer
      lastDate = date
      syncManualFields()
      render({
        date: date || 'Unknown date',
        timer: timer || 'Timer not found',
        status: url ? new URL(url).pathname : '',
      })
    }
  )
}

const fetchTokenFromTrackerTab = async () => {
  const candidateUrls = [
    'http://localhost:3000/*',
    'https://*.mr007.live/*',
  ]
  const tabs = await chrome.tabs.query({ url: candidateUrls })
  const targetTab = tabs[0]
  if (!targetTab) {
    console.warn('NYT Mini Timer: no tracker tab open for token fetch')
    return null
  }

  // Try content-script message first (preferred)
  const tryMessage = () =>
    new Promise(resolve => {
      chrome.tabs.sendMessage(
        targetTab.id,
        { type: 'GET_SUPABASE_TOKEN' },
        response => {
          if (chrome.runtime.lastError) {
            console.warn('NYT Mini Timer: token fetch via message failed', chrome.runtime.lastError.message)
            resolve(null)
            return
          }
          resolve(response?.token || null)
        }
      )
    })

  const tokenFromMessage = await tryMessage()
  if (tokenFromMessage) return tokenFromMessage

  if (!chrome.scripting?.executeScript) {
    console.warn('NYT Mini Timer: scripting API unavailable; cannot inject token snippet')
    return null
  }

  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: targetTab.id },
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
    return result || null
  } catch (err) {
    console.warn('NYT Mini Timer: token fetch via injection failed', err)
    return null
  }
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
  let token = (apiTokenInput.value || '').trim()
  if (!token) {
    statusEl.textContent = 'Looking for Supabase token…'
    token = (await fetchTokenFromTrackerTab()) || ''
    if (token) {
      apiTokenInput.value = token
      await chrome.storage.local.set({ apiToken: token }).catch(() => {})
    }
  }

  if (!token) {
    statusEl.textContent = 'No token found. Open the tracker site in a tab to auto-grab it.'
    return
  }

  const apiUrl = (apiUrlInput.value || '').trim() || DEFAULT_API_URL
  const seconds = parseTimerToSeconds(effectiveTimer)
  if (seconds === null) {
    statusEl.textContent = `Cannot parse timer "${effectiveTimer}" (expected mm:ss).`
    return
  }
  const payloadDate = effectiveDate && /^\d{4}-\d{2}-\d{2}$/.test(effectiveDate) ? effectiveDate : undefined

  statusEl.textContent = 'Sending to API…'
  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({
        seconds,
        date: payloadDate,
      }),
    })
    const body = await res.json().catch(() => null)
    const statusMsg = res.ok ? `API ok: ${body?.status || 'success'}` : `API ${res.status}: ${body?.error || 'failed'}`
    if (res.ok) {
      statusEl.textContent = statusMsg
    } else {
      statusEl.textContent = statusMsg
    }
    const nextHistory = [
      { date: payloadDate || effectiveDate || '—', time: effectiveTimer || '—', status: statusMsg },
      ...history,
    ].slice(0, 10)
    await setHistory(nextHistory)
  } catch (err) {
    statusEl.textContent = `API error: ${err?.message || err}`
  }
}

refreshBtn.addEventListener('click', fetchTimer)
submitBtn.addEventListener('click', maybeSendToApi)
saveBtn.addEventListener('click', saveSettings)
document.addEventListener('DOMContentLoaded', fetchTimer)
document.addEventListener('DOMContentLoaded', async () => {
  await loadSettings()
  history = await getHistory()
  renderHistory()
})
