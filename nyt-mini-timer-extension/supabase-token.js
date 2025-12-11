const readSupabaseToken = () => {
  try {
    const keys = Object.keys(localStorage).filter(k => /^sb-.*-auth-token$/.test(k))
    for (const key of keys) {
      const raw = localStorage.getItem(key)
      if (!raw) continue
      try {
        const parsed = JSON.parse(raw)
        const token = parsed?.access_token || parsed?.currentSession?.access_token
        if (token) {
          console.debug('[NYT Mini Timer] token found in', key)
          return token
        }
      } catch {
        // fallback: sometimes the value is already the token string
        if (typeof raw === 'string' && raw.startsWith('eyJ')) {
          console.debug('[NYT Mini Timer] token found (raw string) in', key)
          return raw
        }
      }
    }
    console.debug('[NYT Mini Timer] no Supabase token found in localStorage')
    return null
  } catch (err) {
    console.warn('[NYT Mini Timer] failed to read Supabase token', err)
    return null
  }
}

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type === 'GET_SUPABASE_TOKEN') {
    sendResponse({ token: readSupabaseToken() })
  }
})
