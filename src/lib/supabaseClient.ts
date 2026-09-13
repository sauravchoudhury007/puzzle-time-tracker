'use client'
import { createClient } from '@supabase/supabase-js'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

/* supabase-js keeps the session in localStorage under this default key
   (`supabase.storageKey` is protected in its types). The browser extension scans
   for the same key to borrow the token, so the session has to stay here. */
export const AUTH_STORAGE_KEY = `sb-${new URL(supabaseUrl).hostname.split('.')[0]}-auth-token`

/** Who was signed in when the session was last saved, read without waiting on a token refresh. */
export function readStoredSession(): { userId: string } | null {
  if (typeof window === 'undefined') return null
  try {
    const raw = window.localStorage.getItem(AUTH_STORAGE_KEY)
    const userId = raw ? JSON.parse(raw)?.user?.id : null
    return typeof userId === 'string' ? { userId } : null
  } catch {
    return null
  }
}
