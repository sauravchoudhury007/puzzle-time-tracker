'use client'

import { useEffect, useState } from 'react'
import NavBar from '@/components/pulse/NavBar'
import { Card, PageShell } from '@/components/pulse/Surface'
import { yearCellVars } from '@/lib/colorUtils'
import { PULSE_DARK, PULSE_LIGHT } from '@/lib/theme'

const TOKEN_ROWS = [
  { name: 'bg', note: 'Page ground' },
  { name: 'surface', note: 'Card' },
  { name: 'surface2', note: 'Inset / pill track' },
  { name: 'ink', note: 'Body text' },
  { name: 'muted', note: 'Secondary text' },
  { name: 'accent', note: 'Electric lime' },
  { name: 'negative', note: 'Errors' },
] as const

export default function ColorsPage() {
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  const legacyYears = Array.from({ length: 22 }, (_, i) => 2014 + i)

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <PageShell maxWidth={1080}>
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow">Design reference</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(44px, 8vw, 84px)',
              lineHeight: 0.95,
              letterSpacing: '-.03em',
              margin: '14px 0 0',
              fontWeight: 400,
            }}
          >
            Pulse, in swatches.
          </h1>
        </div>

        {/* ── Palette ──────────────────────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <div className="eyebrow">Palette</div>
          <div
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 22,
              marginTop: 4,
              marginBottom: 20,
              letterSpacing: '-.01em',
            }}
          >
            Tokens, light and dark
          </div>

          <div style={{ display: 'grid', gap: 10 }}>
            {TOKEN_ROWS.map(row => (
              <div
                key={row.name}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(120px, 1fr) 1fr 1fr',
                  gap: 12,
                  alignItems: 'center',
                }}
              >
                <div>
                  <div style={{ fontFamily: 'var(--mono)', fontSize: 12 }}>--{row.name}</div>
                  <div style={{ fontFamily: 'var(--sans)', fontSize: 11, color: 'var(--muted)' }}>
                    {row.note}
                  </div>
                </div>
                <Swatch color={PULSE_LIGHT[row.name]} label="light" />
                <Swatch color={PULSE_DARK[row.name]} label="dark" />
              </div>
            ))}
          </div>
        </Card>

        {/* ── Heatmap ramp ─────────────────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <div className="eyebrow">Activity ramp</div>
          <div
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 22,
              marginTop: 4,
              marginBottom: 20,
              letterSpacing: '-.01em',
            }}
          >
            Slower → faster
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {[0, 1, 2, 3, 4].map(level => (
              <div key={level} style={{ textAlign: 'center' }}>
                <div
                  style={{
                    width: 64,
                    height: 64,
                    background: `var(--hm-${level})`,
                    borderRadius: 'var(--cell-r)',
                    border: '1px solid var(--rule-soft)',
                  }}
                />
                <div
                  style={{
                    fontFamily: 'var(--mono)',
                    fontSize: 10,
                    color: 'var(--muted)',
                    marginTop: 6,
                  }}
                >
                  {level === 0 ? 'none' : `L${level}`}
                </div>
              </div>
            ))}
          </div>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 18,
              marginBottom: 0,
              lineHeight: 1.6,
            }}
          >
            L4 ≤ 60s · L3 ≤ 90s · L2 ≤ 120s · L1 slower than that.
          </p>
        </Card>

        {/* ── Type ─────────────────────────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <div className="eyebrow">Type</div>
          <div
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 22,
              marginTop: 4,
              marginBottom: 20,
              letterSpacing: '-.01em',
            }}
          >
            Three faces
          </div>
          <div style={{ display: 'grid', gap: 20 }}>
            <TypeRow token="--serif" note="Instrument Serif italic — page titles">
              <span style={{ fontFamily: 'var(--serif)', fontStyle: 'italic', fontSize: 42 }}>
                Ten years, on one wall.
              </span>
            </TypeRow>
            <TypeRow token="--sans" note="Inter 700 — numbers and headings">
              <span
                className="tnum"
                style={{
                  fontFamily: 'var(--sans)',
                  fontWeight: 700,
                  fontSize: 42,
                  letterSpacing: '-.03em',
                }}
              >
                1:06
              </span>
            </TypeRow>
            <TypeRow token="--mono" note="JetBrains Mono — eyebrows and labels">
              <span className="eyebrow" style={{ fontSize: 13 }}>
                Activity grid · 2026
              </span>
            </TypeRow>
          </div>
        </Card>

        {/* ── Legacy ramp ──────────────────────────────────── */}
        <Card>
          <div className="eyebrow">Archive palette</div>
          <div
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 22,
              marginTop: 4,
              marginBottom: 8,
              letterSpacing: '-.01em',
            }}
          >
            Per-year hue ramp
          </div>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 13,
              color: 'var(--muted)',
              marginTop: 0,
              marginBottom: 20,
              lineHeight: 1.6,
              maxWidth: 560,
            }}
          >
            Hue rotates 20° per year from emerald in 2014, with four levels from slow to fast. This
            is what the activity grid and the Frame poster are coloured with — the lime ramp above
            stays for the live, single-value surfaces.
          </p>
          {mounted && (
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {legacyYears.map(year => (
                <div key={year} style={{ textAlign: 'center' }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                    {[4, 3, 2, 1].map(level => (
                      <div
                        key={level}
                        className="hm-year"
                        title={`${year} · level ${level}`}
                        style={{ width: 22, height: 14, borderRadius: 2, ...yearCellVars(year, level) }}
                      />
                    ))}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: 9,
                      color: 'var(--muted)',
                      marginTop: 4,
                    }}
                  >
                    {`'${String(year).slice(2)}`}
                  </div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </PageShell>
    </main>
  )
}

function Swatch({ color, label }: { color: string; label: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
      <div
        style={{
          width: 40,
          height: 28,
          background: color,
          borderRadius: 6,
          border: '1px solid var(--rule-soft)',
          flex: '0 0 auto',
        }}
      />
      <div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 11 }}>{color}</div>
        <div style={{ fontFamily: 'var(--mono)', fontSize: 9, color: 'var(--muted)' }}>{label}</div>
      </div>
    </div>
  )
}

function TypeRow({
  token,
  note,
  children,
}: {
  token: string
  note: string
  children: React.ReactNode
}) {
  return (
    <div style={{ borderTop: '1px solid var(--rule-soft)', paddingTop: 16 }}>
      <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)', marginBottom: 8 }}>
        {token} — {note}
      </div>
      {children}
    </div>
  )
}
