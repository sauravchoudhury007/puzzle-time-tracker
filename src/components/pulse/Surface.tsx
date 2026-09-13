'use client'

import type { CSSProperties, ReactNode } from 'react'

/** The Pulse card: flat surface, hairline rule, 10px radius. */
export function Card({
  children,
  style,
  padding = 28,
  className,
}: {
  children: ReactNode
  style?: CSSProperties
  padding?: number
  className?: string
}) {
  return (
    <section
      className={className}
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--rule-soft)',
        borderRadius: 'var(--card-r)',
        padding,
        ...style,
      }}
    >
      {children}
    </section>
  )
}

/** Mono eyebrow + heavy sans title, the standard header inside a Pulse card. */
export function CardHeading({
  eyebrow,
  title,
  trailing,
  style,
}: {
  eyebrow: string
  title?: ReactNode
  trailing?: ReactNode
  style?: CSSProperties
}) {
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: title ? 'baseline' : 'center',
        gap: 16,
        flexWrap: 'wrap',
        ...style,
      }}
    >
      <div>
        <div className="eyebrow">{eyebrow}</div>
        {title != null && (
          <div
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 22,
              marginTop: 4,
              letterSpacing: '-.01em',
            }}
          >
            {title}
          </div>
        )}
      </div>
      {trailing}
    </div>
  )
}

/** Compact metric tile used in the dashboard hero and home sidebar. */
export function Stat({
  label,
  value,
  unit,
  accent = false,
  size = 34,
}: {
  label: string
  value: ReactNode
  unit?: string
  accent?: boolean
  size?: number
}) {
  return (
    <div
      style={{
        background: 'var(--surface)',
        border: '1px solid var(--rule-soft)',
        borderRadius: 'var(--card-r)',
        padding: '18px 20px',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--mono)',
          fontSize: 10,
          letterSpacing: '.2em',
          textTransform: 'uppercase',
          color: 'var(--muted)',
        }}
      >
        {label}
      </div>
      <div
        className="tnum"
        style={{
          fontFamily: 'var(--sans)',
          fontWeight: 700,
          fontSize: size,
          letterSpacing: '-.02em',
          marginTop: 4,
          color: accent ? 'var(--accent)' : 'var(--ink)',
          lineHeight: 1.1,
        }}
      >
        {value}
        {unit && (
          <span
            style={{
              fontSize: 14,
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
              marginLeft: 6,
              fontWeight: 400,
            }}
          >
            {unit}
          </span>
        )}
      </div>
    </div>
  )
}

/** Page frame: nav sits above, content is centred with Pulse gutters. */
export function PageShell({
  children,
  maxWidth = 1320,
  style,
  className,
}: {
  children: ReactNode
  maxWidth?: number
  style?: CSSProperties
  className?: string
}) {
  return (
    <div className={className} style={{ maxWidth, margin: '0 auto', padding: '40px 28px 60px', ...style }}>
      {children}
    </div>
  )
}

/** Full-bleed lime ticker used at the top of Today. */
export function TickerBar({ children }: { children: ReactNode }) {
  return (
    <div
      style={{
        background: 'var(--accent)',
        color: '#0c0c0a',
        padding: '6px 28px',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        letterSpacing: '.2em',
        textTransform: 'uppercase',
        display: 'flex',
        justifyContent: 'space-between',
        gap: 16,
        flexWrap: 'wrap',
        fontWeight: 600,
      }}
    >
      {children}
    </div>
  )
}
