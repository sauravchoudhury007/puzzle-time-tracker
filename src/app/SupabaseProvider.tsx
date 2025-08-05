'use client'

import { SessionContextProvider } from '@supabase/auth-helpers-react'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import { useState, ReactNode } from 'react'
import type { Session } from '@supabase/auth-helpers-nextjs'

interface Props {
  children: ReactNode
  serverSession: Session | null
}

export function SupabaseProvider({ children, serverSession }: Props) {
  // This is the non-deprecated hook for client-side instantiation
  const [supabaseClient] = useState(() => createClientComponentClient())

  return (
    <SessionContextProvider
      supabaseClient={supabaseClient}
      initialSession={serverSession}
    >
      {children}
    </SessionContextProvider>
  )
}