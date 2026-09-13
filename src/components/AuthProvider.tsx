'use client'

import { ReactNode, useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({ children }: AuthProviderProps) {
  const [loading, setLoading] = useState(true)
  const router = useRouter()

  useEffect(() => {
    // On mount: check for an existing session in localStorage
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) {
        router.replace('/login')
      }
      setLoading(false)
    })

    // Subscribe to auth events across tabs
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        if (!session) {
          router.replace('/login')
        }
      }
    )

    return () => {
      listener.subscription.unsubscribe()
    }
  }, [router])

  if (loading) {
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