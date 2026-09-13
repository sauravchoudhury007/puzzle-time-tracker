'use client'

import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import NavBar from '@/components/pulse/NavBar'
import { Card, PageShell } from '@/components/pulse/Surface'
import Poster, {
  PAPERS,
  type PaperKey,
  type PosterInk,
  type PosterLayout,
  type PosterOptions,
} from '@/components/pulse/Poster'
import { usePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { SITE } from '@/lib/site'
import { FRAME_OPTIONS_KEY } from '@/lib/storageKeys'

const LAYOUTS: { value: PosterLayout; label: string; note: string }[] = [
  { value: 'grid', label: 'Blocks', note: 'Each year as a 7×53 calendar block' },
  { value: 'ribbon', label: 'Ribbon', note: 'Each year as one continuous line of days' },
]

const INKS: { value: PosterInk; label: string }[] = [
  { value: 'paper', label: 'Paper' },
  { value: 'ink', label: 'Ink' },
]

const DEFAULT_OPTIONS: PosterOptions = {
  layout: 'grid',
  paper: 'a3',
  ink: 'paper',
  title: SITE.brand,
  subtitle: SITE.pair,
  showStats: true,
  showLegend: true,
}

const MAX_TEXT = 120

/** Stored setup is user-editable text on disk — take only what still makes sense. */
function sanitize(raw: unknown): Partial<PosterOptions> {
  if (!raw || typeof raw !== 'object') return {}
  const saved = raw as Record<string, unknown>
  const out: Partial<PosterOptions> = {}

  if (LAYOUTS.some(l => l.value === saved.layout)) out.layout = saved.layout as PosterLayout
  if (typeof saved.paper === 'string' && saved.paper in PAPERS) out.paper = saved.paper as PaperKey
  if (INKS.some(i => i.value === saved.ink)) out.ink = saved.ink as PosterInk
  if (typeof saved.title === 'string') out.title = saved.title.slice(0, MAX_TEXT)
  if (typeof saved.subtitle === 'string') out.subtitle = saved.subtitle.slice(0, MAX_TEXT)
  if (typeof saved.showStats === 'boolean') out.showStats = saved.showStats
  if (typeof saved.showLegend === 'boolean') out.showLegend = saved.showLegend

  return out
}

export default function FramePage() {
  const { stats, loading, error } = usePuzzleTimes()

  const [options, setOptions] = useState<PosterOptions>(DEFAULT_OPTIONS)
  // The page is prerendered, so the stored setup can only be read after mount.
  const [restored, setRestored] = useState(false)

  const set = <K extends keyof PosterOptions>(key: K, value: PosterOptions[K]) =>
    setOptions(prev => ({ ...prev, [key]: value }))

  const seeded = useRef(false)

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(FRAME_OPTIONS_KEY)
      if (raw) {
        const saved = sanitize(JSON.parse(raw))
        setOptions(prev => ({ ...prev, ...saved }))
        // Their own wording wins over the year range seeded below.
        if (saved.subtitle !== undefined) seeded.current = true
      }
    } catch {
      // Unreadable or private browsing — fall back to the defaults.
    }
    setRestored(true)
  }, [])

  useEffect(() => {
    if (!restored) return
    try {
      window.localStorage.setItem(FRAME_OPTIONS_KEY, JSON.stringify(options))
    } catch {
      // Private browsing — the setup just will not survive a reload.
    }
  }, [options, restored])

  // Fill in the year range once the data is known, unless it has been edited.
  useEffect(() => {
    if (seeded.current || !restored || !stats) return
    seeded.current = true
    const from = stats.startDate.getUTCFullYear()
    const to = stats.endDate.getUTCFullYear()
    set('subtitle', `${SITE.pair} · ${from}–${to}`)
  }, [stats, restored])

  const paper = PAPERS[options.paper]
  const { ref: stageRef, scale } = useFitScale(paper.width)

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <div className="screen-only">
        <NavBar />
      </div>

      {/* Sized to the chosen sheet so the print matches the preview exactly. */}
      <style>{`@media print { @page { size: ${paper.cssSize}; margin: 0 } }`}</style>

      <PageShell className="frame-shell">
        <div className="screen-only" style={{ marginBottom: 28 }}>
          <div className="eyebrow">Printable poster</div>
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
            Ten years, on one wall.
          </h1>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 15,
              color: 'var(--muted)',
              maxWidth: 560,
              marginTop: 14,
              lineHeight: 1.55,
            }}
          >
            Every year in its own hue, every morning a square. Print it, or save it as a PDF from
            the print dialog, and it comes out at the sheet size you pick.
          </p>
        </div>

        {error && (
          <p
            className="screen-only"
            style={{ color: 'var(--negative)', fontFamily: 'var(--mono)', fontSize: 13 }}
          >
            Could not load your times: {error}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(260px, 300px) 1fr',
            gap: 24,
            alignItems: 'start',
          }}
          className="frame-split"
        >
          {/* ── Controls ─────────────────────────────── */}
          <Card className="screen-only" padding={22} style={{ position: 'sticky', top: 20 }}>
            <Field label="Layout">
              {LAYOUTS.map(l => (
                <Choice
                  key={l.value}
                  active={options.layout === l.value}
                  onClick={() => set('layout', l.value)}
                >
                  {l.label}
                </Choice>
              ))}
            </Field>
            <Note>{LAYOUTS.find(l => l.value === options.layout)?.note}</Note>

            <Field label="Sheet">
              {(Object.keys(PAPERS) as PaperKey[]).map(key => (
                <Choice key={key} active={options.paper === key} onClick={() => set('paper', key)}>
                  {PAPERS[key].label}
                </Choice>
              ))}
            </Field>

            <Field label="Ink">
              {INKS.map(i => (
                <Choice key={i.value} active={options.ink === i.value} onClick={() => set('ink', i.value)}>
                  {i.label}
                </Choice>
              ))}
            </Field>

            <Field label="Title">
              <input
                value={options.title}
                onChange={e => set('title', e.target.value)}
                style={inputStyle}
                aria-label="Poster title"
              />
            </Field>

            <Field label="Subtitle">
              <input
                value={options.subtitle}
                onChange={e => set('subtitle', e.target.value)}
                style={inputStyle}
                aria-label="Poster subtitle"
              />
            </Field>

            <Field label="Include">
              <Choice active={options.showStats} onClick={() => set('showStats', !options.showStats)}>
                Stats
              </Choice>
              <Choice
                active={options.showLegend}
                onClick={() => set('showLegend', !options.showLegend)}
              >
                Legend
              </Choice>
            </Field>

            <button
              type="button"
              onClick={() => window.print()}
              disabled={!stats}
              style={{
                marginTop: 22,
                width: '100%',
                background: stats ? 'var(--accent)' : 'var(--surface2)',
                color: stats ? '#0c0c0a' : 'var(--muted)',
                border: stats ? 0 : '1px solid var(--rule-soft)',
                borderRadius: 'var(--card-r)',
                padding: '14px 20px',
                fontFamily: 'var(--mono)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '.22em',
                textTransform: 'uppercase',
                cursor: stats ? 'pointer' : 'default',
              }}
            >
              Print / save PDF
            </button>
            <Note>
              Turn on &ldquo;Background graphics&rdquo; in the print dialog, and set margins to
              none.
            </Note>
          </Card>

          {/* ── Preview ──────────────────────────────── */}
          <div ref={stageRef} className="frame-stage">
            {loading && !stats && (
              <p className="eyebrow screen-only" style={{ margin: 0 }}>
                Loading your archive…
              </p>
            )}
            {stats && (
              <div
                className="poster-scaler"
                style={{
                  width: paper.width * scale,
                  height: paper.height * scale,
                }}
              >
                <div
                  style={{
                    transform: `scale(${scale})`,
                    transformOrigin: 'top left',
                    width: paper.width,
                    height: paper.height,
                    boxShadow: '0 30px 80px rgba(0,0,0,.28)',
                  }}
                >
                  <Poster stats={stats} options={options} />
                </div>
              </div>
            )}
          </div>
        </div>
      </PageShell>
    </main>
  )
}

/** Scales the sheet down to whatever width the stage has, never up past 1:1. */
function useFitScale(paperWidth: number) {
  const ref = useRef<HTMLDivElement | null>(null)
  const [scale, setScale] = useState(0.4)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const measure = () => {
      const available = el.clientWidth
      if (available > 0) setScale(Math.min(1, available / paperWidth))
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [paperWidth])

  return { ref, scale }
}

const inputStyle = {
  width: '100%',
  background: 'var(--surface2)',
  border: '1px solid var(--rule-soft)',
  borderRadius: 8,
  padding: '9px 11px',
  fontFamily: 'var(--sans)',
  fontSize: 14,
  color: 'var(--ink)',
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 16 }}>
      <div className="eyebrow" style={{ marginBottom: 8 }}>
        {label}
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{children}</div>
    </div>
  )
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        fontFamily: 'var(--sans)',
        fontSize: 12,
        color: 'var(--muted)',
        lineHeight: 1.5,
        margin: '-8px 0 16px',
      }}
    >
      {children}
    </p>
  )
}

function Choice({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      style={{
        background: active ? 'var(--ink)' : 'transparent',
        color: active ? 'var(--bg)' : 'var(--muted)',
        border: `1px solid ${active ? 'var(--ink)' : 'var(--rule-soft)'}`,
        borderRadius: 99,
        padding: '7px 13px',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        fontWeight: 600,
        letterSpacing: '.1em',
        cursor: 'pointer',
      }}
    >
      {children}
    </button>
  )
}
