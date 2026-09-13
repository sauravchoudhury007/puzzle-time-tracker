'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import NavBar from '@/components/pulse/NavBar'
import { Card, CardHeading, PageShell, Stat } from '@/components/pulse/Surface'
import Heatmap, { HeatmapLegend, type HeatCell } from '@/components/pulse/Heatmap'
import { usePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { fmtTime } from '@/lib/format'
import { LAST_SELECTED_PUZZLE_DATE_KEY } from '@/lib/storageKeys'

export default function TrackerPage() {
  const { stats, loading, error } = usePuzzleTimes()
  const [openYears, setOpenYears] = useState<Set<number>>(new Set())

  const years = useMemo(() => {
    if (!stats) return []
    const first = stats.startDate.getUTCFullYear()
    const last = stats.endDate.getUTCFullYear()
    const out: { year: number; start: Date; end: Date }[] = []
    for (let y = first; y <= last; y++) {
      const start = y === first ? stats.startDate : new Date(Date.UTC(y, 0, 1))
      const yearEnd = new Date(Date.UTC(y, 11, 31))
      const end = yearEnd > stats.endDate ? stats.endDate : yearEnd
      if (start <= end) out.push({ year: y, start, end })
    }
    return out.reverse()
  }, [stats])

  /** Opens that day's NYT Mini, and remembers the date for the entry form. */
  const openPuzzle = (cell: HeatCell) => {
    if (!cell.date) return
    try {
      window.localStorage.setItem(LAST_SELECTED_PUZZLE_DATE_KEY, cell.date)
    } catch {
      // Private browsing — the entry form just will not be pre-filled.
    }
    window.open(
      `https://www.nytimes.com/crosswords/game/mini/${cell.date.replace(/-/g, '/')}`,
      '_blank',
      'noopener,noreferrer'
    )
  }

  const toggleYear = (year: number) =>
    setOpenYears(prev => {
      const next = new Set(prev)
      if (next.has(year)) next.delete(year)
      else next.add(year)
      return next
    })

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <PageShell>
        <div style={{ marginBottom: 32 }}>
          <div className="eyebrow">Activity grid</div>
          <h1
            style={{
              fontFamily: 'var(--serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(48px, 9vw, 96px)',
              lineHeight: 0.95,
              letterSpacing: '-.03em',
              margin: '14px 0 0',
              fontWeight: 400,
            }}
          >
            Every morning,{' '}
            <span
              style={{
                fontFamily: 'var(--sans)',
                fontStyle: 'normal',
                fontWeight: 700,
                color: 'var(--accent)',
                fontSize: '0.8em',
              }}
            >
              one square
            </span>
          </h1>
          <p
            style={{
              fontFamily: 'var(--sans)',
              fontSize: 15,
              color: 'var(--muted)',
              maxWidth: 520,
              marginTop: 14,
              lineHeight: 1.55,
            }}
          >
            Every year gets its own hue; deeper squares are faster solves. Click any day to open
            that morning&rsquo;s Mini, or{' '}
            <Link href="/frame" style={{ color: 'var(--accent)' }}>
              hang the whole thing on a wall
            </Link>
            .
          </p>
        </div>

        {error && (
          <p style={{ color: 'var(--negative)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            Could not load your times: {error}
          </p>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
            gap: 10,
            marginBottom: 20,
          }}
        >
          <Stat label="Completions" value={(stats?.solvedCount ?? 0).toLocaleString()} accent />
          <Stat label="Days tracked" value={(stats?.totalDays ?? 0).toLocaleString()} />
          <Stat
            label="Completion rate"
            value={stats ? `${(stats.completion * 100).toFixed(1)}%` : '—'}
          />
          <Stat label="Longest streak" value={stats?.maxStreak ?? 0} unit="days" />
        </div>

        <Card style={{ marginBottom: 20 }}>
          <CardHeading
            eyebrow="All-time"
            title={
              <>
                {stats?.startDate.getUTCFullYear() ?? '—'} → {stats?.endDate.getUTCFullYear() ?? '—'}
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                  {' '}
                  · {fmtTime(stats ? Math.round(stats.avg) : null)} pair avg
                </span>
              </>
            }
            trailing={
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 10,
                  letterSpacing: '.14em',
                  textTransform: 'uppercase',
                  color: 'var(--muted)',
                }}
              >
                A hue per year
              </div>
            }
            style={{ marginBottom: 18 }}
          />
          {loading && (
            <p className="eyebrow" style={{ margin: 0 }}>
              Loading grid…
            </p>
          )}
          {stats && (
            <Heatmap
              start={stats.startDate}
              end={stats.endDate}
              times={stats.times}
              size={11}
              gap={2}
              palette="year"
              onSelect={openPuzzle}
            />
          )}
        </Card>

        {years.map(({ year, start, end }) => {
          const solved = stats?.solved.filter(d => d.date.startsWith(`${year}-`)) ?? []
          const avg = solved.length
            ? Math.round(solved.reduce((s, d) => s + d.seconds, 0) / solved.length)
            : null
          const best = solved.length ? Math.min(...solved.map(d => d.seconds)) : null
          const isOpen = openYears.has(year) || year === stats?.endDate.getUTCFullYear()

          return (
            <Card key={year} style={{ marginBottom: 12 }} padding={22}>
              <CardHeading
                eyebrow={`${solved.length} solves`}
                title={
                  <>
                    {year}
                    <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                      {' '}
                      · {fmtTime(avg)} avg · best {fmtTime(best)}
                    </span>
                  </>
                }
                trailing={
                  <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
                    <HeatmapLegend year={year} />
                    {year !== stats?.endDate.getUTCFullYear() && (
                      <button
                        type="button"
                        onClick={() => toggleYear(year)}
                        aria-expanded={isOpen}
                        style={{
                          background: 'transparent',
                          border: '1px solid var(--rule-soft)',
                          borderRadius: 99,
                          padding: '6px 14px',
                          fontFamily: 'var(--mono)',
                          fontSize: 11,
                          letterSpacing: '.14em',
                          textTransform: 'uppercase',
                          color: 'var(--muted)',
                          cursor: 'pointer',
                        }}
                      >
                        {isOpen ? 'Hide' : 'Show'}
                      </button>
                    )}
                  </div>
                }
                style={{ marginBottom: isOpen ? 16 : 0 }}
              />
              {isOpen && stats && (
                <Heatmap
                  start={start}
                  end={end}
                  times={stats.times}
                  size={13}
                  gap={3}
                  palette="year"
                  onSelect={openPuzzle}
                />
              )}
            </Card>
          )
        })}
      </PageShell>
    </main>
  )
}
