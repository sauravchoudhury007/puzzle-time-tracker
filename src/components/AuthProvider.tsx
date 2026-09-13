'use client'

import { ReactNode, useState, useEffect } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { readStoredSession, supabase } from '@/lib/supabaseClient'
import { clearPhotosCache } from '@/hooks/usePhotos'
import { clearPuzzleTimesCache } from '@/hooks/usePuzzleTimes'

/** Pages that render without a session. */
const PUBLIC_PATHS = ['/login']

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  // False on the server and through hydration, so both render the loading screen.
  const [ready, setReady] = useState(false)
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    // A stored session means a returning reader: show the page, and whatever is
    // cached, right away. supabase-js refreshes an expired token behind it, and
    // every query waits for that refresh, so nothing goes out unauthenticated.
    if (readStoredSession()) setReady(true)

    // INITIAL_SESSION arrives once the client has loaded (and if need be refreshed)
    // the session; later events follow sign-in and sign-out in any tab.
    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) {
        setReady(true)
        return
      }
      if (event === 'SIGNED_OUT') {
        clearPuzzleTimesCache()
        clearPhotosCache()
      } else if (readStoredSession()) {
        // The refresh failed but the session was kept (offline, flaky network).
        // supabase-js retries on its own, so stay on the page with what is cached.
        return
      }
      setReady(false)
      router.replace('/login')
    })

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  if (!ready && !PUBLIC_PATHS.includes(pathname)) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--bg)',
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          fontSize: 11,
          letterSpacing: '.24em',
          textTransform: 'uppercase',
        }}
      >
        Loading…
      </div>
    )
  }

  return <>{children}</>
}
