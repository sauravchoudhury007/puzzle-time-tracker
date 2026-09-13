'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { navLinks } from '@/lib/navLinks'
import { useTheme } from '@/components/ThemeProvider'

export const BRAND = 'The Mini Almanac'

export default function NavBar() {
  const pathname = usePathname()
  const { mode, toggleMode } = useTheme()

  return (
    <div
      data-testid="navbar"
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 16,
        padding: '14px 28px',
        borderBottom: '1px solid var(--rule-soft)',
        position: 'relative',
        zIndex: 5,
        flexWrap: 'wrap',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
        <Link
          href="/"
          style={{
            fontFamily: 'var(--serif)',
            fontWeight: 400,
            fontSize: 20,
            letterSpacing: '-.01em',
          }}
        >
          {BRAND}
        </Link>
        <div className="nav-divider" style={{ height: 14, width: 1, background: 'var(--rule-soft)' }} />
        <nav
          style={{
            display: 'flex',
            gap: 18,
            fontSize: 13,
            fontFamily: 'var(--sans)',
            fontWeight: 500,
            flexWrap: 'wrap',
          }}
        >
          {navLinks.map(item => {
            const active = pathname === item.href
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                style={{
                  padding: '4px 0',
                  color: active ? 'var(--ink)' : 'var(--muted)',
                  borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
                  transition: 'color .15s ease, border-color .15s ease',
                }}
              >
                {item.label}
              </Link>
            )
          })}
        </nav>
      </div>

      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 14,
          fontSize: 11,
          color: 'var(--muted)',
          fontFamily: 'var(--mono)',
          letterSpacing: '.06em',
          textTransform: 'uppercase',
        }}
      >
        <span>Pulse{mode ? ` · ${mode}` : ''}</span>
        <button
          type="button"
          onClick={toggleMode}
          title="Toggle light/dark"
          aria-label="Toggle light or dark mode"
          style={{
            background: 'transparent',
            border: '1px solid var(--rule-soft)',
            width: 28,
            height: 28,
            borderRadius: 99,
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            padding: 0,
          }}
        >
          {/* Rendered only once mounted so SSR and first paint agree. */}
          <span style={{ fontSize: 13 }}>{mode === 'dark' ? '☾' : mode === 'light' ? '☀' : ''}</span>
        </button>
      </div>
    </div>
  )
}
