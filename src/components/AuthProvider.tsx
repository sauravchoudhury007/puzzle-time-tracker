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
      <div className="flex min-h-screen items-center justify-center">
        Loading…
      </div>
    )
  }

  return <>{children}</>
}