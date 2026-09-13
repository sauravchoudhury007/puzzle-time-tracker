'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabaseClient'
import { SITE } from '@/lib/site'

const fieldStyle = {
  display: 'block',
  width: '100%',
  marginTop: 8,
  background: 'var(--surface2)',
  border: '1px solid var(--rule-soft)',
  borderRadius: 'var(--card-r)',
  padding: '13px 14px',
  fontFamily: 'var(--sans)',
  fontSize: 15,
  color: 'var(--ink)',
}

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const router = useRouter()

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setLoading(true)
    setError(null)
    const { error: authError } = await supabase.auth.signInWithPassword({ email, password })
    setLoading(false)
    if (authError) setError(authError.message)
    else router.replace('/')
  }

  return (
    <main
      style={{
        background: 'var(--bg)',
        color: 'var(--ink)',
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}
    >
      <div style={{ width: '100%', maxWidth: 420 }}>
        <div style={{ textAlign: 'center', marginBottom: 28 }}>
          <div className="eyebrow">{SITE.brand}</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(40px, 9vw, 60px)',
              lineHeight: 1,
              letterSpacing: '-.03em',
              margin: '12px 0 0',
              fontWeight: 400,
            }}
          >
            Welcome back.
          </h1>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 14,
              color: 'var(--muted)',
              marginTop: 12,
              lineHeight: 1.6,
            }}
          >
            {SITE.tagline}
          </p>
        </div>

        <form
          onSubmit={handleLogin}
          style={{
            background: 'var(--surface)',
            border: '1px solid var(--rule-soft)',
            borderRadius: 'var(--card-r)',
            padding: 28,
          }}
        >
          <label style={{ display: 'block', marginBottom: 18 }}>
            <span className="eyebrow">Email</span>
            <input
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={e => setEmail(e.target.value)}
              required
              style={fieldStyle}
            />
          </label>

          <label style={{ display: 'block', marginBottom: 24 }}>
            <span className="eyebrow">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
              style={fieldStyle}
            />
          </label>

          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: 'var(--accent)',
              color: '#0c0c0a',
              border: 0,
              borderRadius: 'var(--card-r)',
              padding: '15px 20px',
              fontFamily: 'var(--mono)',
              fontSize: 12,
              fontWeight: 600,
              letterSpacing: '.22em',
              textTransform: 'uppercase',
              cursor: loading ? 'default' : 'pointer',
              opacity: loading ? 0.6 : 1,
            }}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>

          {error && (
            <p
              role="status"
              style={{
                marginTop: 18,
                textAlign: 'center',
                fontFamily: 'var(--sans)',
                fontSize: 14,
                color: 'var(--negative)',
              }}
            >
              {error}
            </p>
          )}
        </form>
      </div>
    </main>
  )
}
