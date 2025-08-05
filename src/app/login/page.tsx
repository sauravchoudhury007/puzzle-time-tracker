'use client'

import { useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    const { error: authError } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    if (authError) {
      setError(authError.message)
    } else {
      router.replace('/')  // go to dashboard
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <form
        onSubmit={handleLogin}
        className="w-full max-w-sm space-y-4 rounded bg-white dark:bg-gray-800 p-6 shadow"
      >
        <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100">
          Log In
        </h1>
        {error && (
          <p className="text-sm text-red-600">{error}</p>
        )}
        <input
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={e => setEmail(e.target.value)}
          className="w-full rounded border px-3 py-2 focus:outline-none focus:ring"
          required
        />
        <input
          type="password"
          placeholder="••••••••"
          value={password}
          onChange={e => setPassword(e.target.value)}
          className="w-full rounded border px-3 py-2 focus:outline-none focus:ring"
          required
        />
        <button
          type="submit"
          className="w-full rounded bg-green-600 py-2 text-white hover:bg-green-700"
        >
          Sign In
        </button>
      </form>
    </main>
  )
}