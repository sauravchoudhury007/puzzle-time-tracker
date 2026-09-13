'use client'

import { useMemo, useState } from 'react'
import NavBar from '@/components/pulse/NavBar'
import { Card, CardHeading, PageShell, Stat } from '@/components/pulse/Surface'
import Heatmap, { HeatmapLegend } from '@/components/pulse/Heatmap'
import { BestProgression, HistBar, LineChart, RadialDow } from '@/components/pulse/charts'
import { usePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { fmtDateShort, fmtTime } from '@/lib/format'
import { filterByRange } from '@/lib/puzzleStats'

const RANGES = [
  { value: '1m', label: '1M' },
  { value: '3m', label: '3M' },
  { value: '6m', label: '6M' },
  { value: '1y', label: '1Y' },
  { value: 'all', label: 'All' },
]

const RANGE_TITLES: Record<string, string> = {
  '1m': 'Trend, last month',
  '3m': 'Trend, last 3 months',
  '6m': 'Trend, last 6 months',
  '1y': 'Trend, last year',
  all: 'Trend, all-time',
}

export default function DashboardPage() {
  const { stats, loading, error } = usePuzzleTimes()
  const [range, setRange] = useState('all')
  const [year, setYear] = useState<number | null>(null)

  const years = useMemo(() => {
    if (!stats) return []
    const first = stats.solved[0]
      ? Number(stats.solved[0].date.slice(0, 4))
      : stats.endDate.getUTCFullYear()
    const out: number[] = []
    for (let y = first; y <= stats.endDate.getUTCFullYear(); y++) out.push(y)
    return out
  }, [stats])

  const activeYear = year ?? stats?.endDate.getUTCFullYear() ?? new Date().getUTCFullYear()

  const gridRange = useMemo(() => {
    const start = new Date(Date.UTC(activeYear, 0, 1))
    const yearEnd = new Date(Date.UTC(activeYear, 11, 31))
    const end = stats && yearEnd > stats.endDate ? stats.endDate : yearEnd
    return { start, end }
  }, [activeYear, stats])

  const yearSolved = stats?.solved.filter(d => d.date.startsWith(`${activeYear}-`)) ?? []
  const yearAvg = yearSolved.length
    ? Math.round(yearSolved.reduce((s, d) => s + d.seconds, 0) / yearSolved.length)
    : 0

  const monthly = stats ? filterByRange(stats.monthly, range) : []
  const weekly = stats ? filterByRange(stats.weekly, range) : []

  const dowStats = useMemo(() => {
    if (!stats) return []
    if (range === 'all') return stats.dowStats
    const cutoff = filterByRange(
      stats.solved.map(d => ({ ...d, month: d.date })),
      range
    )
    const sums = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
    cutoff.forEach(d => {
      const i = new Date(`${d.date}T00:00:00Z`).getUTCDay()
      sums[i].sum += d.seconds
      sums[i].n += 1
    })
    const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    return [1, 2, 3, 4, 5, 6, 0].map(i => ({
      day: names[i],
      avg: sums[i].n ? sums[i].sum / sums[i].n : 0,
    }))
  }, [stats, range])

  const hours = stats ? stats.totalSeconds / 3600 : 0

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <PageShell>
        {error && (
          <p style={{ color: 'var(--negative)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            Could not load your times: {error}
          </p>
        )}

        {/* ── Hero ─────────────────────────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 40,
            alignItems: 'end',
            marginBottom: 36,
          }}
        >
          <div>
            <div className="eyebrow">Stats deck</div>
            <h1
              style={{
                fontFamily: 'var(--serif)',
                fontStyle: 'italic',
                fontSize: 'clamp(64px, 11vw, 110px)',
                lineHeight: 0.92,
                letterSpacing: '-.03em',
                margin: '14px 0 0',
                fontWeight: 400,
              }}
            >
              {loading ? '—' : hours.toFixed(0)}
              <span
                style={{
                  color: 'var(--accent)',
                  fontStyle: 'normal',
                  fontFamily: 'var(--sans)',
                  fontWeight: 700,
                  fontSize: 'clamp(52px, 9vw, 90px)',
                }}
              >
                {' '}
                hrs
              </span>
            </h1>
            <p
              style={{
                fontFamily: 'var(--sans)',
                fontSize: 15,
                color: 'var(--muted)',
                maxWidth: 480,
                marginTop: 14,
                lineHeight: 1.55,
              }}
            >
              Time we&rsquo;ve spent on {(stats?.solvedCount ?? 0).toLocaleString()} minis, together.
              Mostly before coffee.
            </p>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
            <Stat label="Best ever" value={fmtTime(stats?.best ?? null)} accent />
            <Stat label="Pair avg" value={stats ? fmtTime(Math.round(stats.avg)) : '—'} />
            <Stat label="Streak" value={stats?.curStreak ?? 0} unit="days" />
            <Stat
              label="Completion"
              value={stats ? `${(stats.completion * 100).toFixed(0)}%` : '—'}
            />
          </div>
        </div>

        {/* ── Activity grid ────────────────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeading
            eyebrow={`Activity grid · ${activeYear}`}
            title={
              <>
                {yearSolved.length} solves
                <span style={{ color: 'var(--muted)', fontWeight: 500 }}>
                  {' '}
                  · {fmtTime(yearAvg)} pair avg
                </span>
              </>
            }
            trailing={
              <div
                style={{
                  display: 'flex',
                  gap: 4,
                  padding: 4,
                  background: 'var(--surface2)',
                  borderRadius: 99,
                  flexWrap: 'wrap',
                }}
              >
                {years.map(y => (
                  <button
                    key={y}
                    type="button"
                    onClick={() => setYear(y)}
                    aria-pressed={y === activeYear}
                    style={{
                      background: y === activeYear ? 'var(--ink)' : 'transparent',
                      color: y === activeYear ? 'var(--bg)' : 'var(--muted)',
                      border: 0,
                      padding: '6px 12px',
                      borderRadius: 99,
                      fontFamily: 'var(--mono)',
                      fontSize: 11,
                      fontWeight: 600,
                      cursor: 'pointer',
                      letterSpacing: '.06em',
                    }}
                  >
                    {y}
                  </button>
                ))}
              </div>
            }
            style={{ marginBottom: 18 }}
          />
          {stats && <Heatmap start={gridRange.start} end={gridRange.end} times={stats.times} />}
          <div
            style={{
              marginTop: 12,
              display: 'flex',
              justifyContent: 'space-between',
              gap: 12,
              flexWrap: 'wrap',
            }}
          >
            <HeatmapLegend />
            <div style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
              Hover for solve time
            </div>
          </div>
        </Card>

        {/* ── Personal best over time ──────────────────────── */}
        <Card style={{ marginBottom: 20 }}>
          <CardHeading
            eyebrow="Personal best, over time"
            title={
              <>
                Record now:{' '}
                <span className="tnum" style={{ color: 'var(--accent)' }}>
                  {fmtTime(stats?.best ?? null)}
                </span>
              </>
            }
            trailing={
              <div
                style={{
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  color: 'var(--muted)',
                  letterSpacing: '.1em',
                }}
              >
                monthly running min
              </div>
            }
            style={{ marginBottom: 18 }}
          />
          {stats && <BestProgression days={stats.days} height={170} />}
        </Card>

        {/* ── Range control ────────────────────────────────── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            gap: 12,
            margin: '28px 0 14px',
            flexWrap: 'wrap',
          }}
        >
          <div className="eyebrow">Trends</div>
          <RangePills value={range} onChange={setRange} />
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <Card style={{ gridColumn: 'span 1' }}>
            <CardHeading
              eyebrow="Monthly average"
              title={RANGE_TITLES[range]}
              style={{ marginBottom: 18 }}
            />
            <LineChart data={monthly} height={220} />
          </Card>

          <Card>
            <div className="eyebrow">Day-of-week</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 6,
                letterSpacing: '-.01em',
              }}
            >
              Pair avg by day
            </div>
            <RadialDow stats={dowStats} size={220} />
          </Card>
        </div>

        <Card style={{ marginBottom: 20 }}>
          <CardHeading
            eyebrow="Weekly average"
            title="Week over week"
            style={{ marginBottom: 18 }}
          />
          <LineChart data={weekly} height={220} />
        </Card>

        {/* ── Distribution + records ───────────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
            marginBottom: 20,
          }}
        >
          <Card>
            <div className="eyebrow">Solve-time distribution</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 18,
                letterSpacing: '-.01em',
              }}
            >
              How a normal morning goes
            </div>
            <HistBar buckets={stats?.buckets ?? []} height={200} />
          </Card>

          <Card>
            <div className="eyebrow">Top 5 fastest mornings</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 14,
                letterSpacing: '-.01em',
              }}
            >
              Hall of fame
            </div>
            <RecordList rows={stats?.fastest.slice(0, 5) ?? []} />
          </Card>
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 20,
          }}
        >
          <Card>
            <div className="eyebrow">Top 5 slowest mornings</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 14,
                letterSpacing: '-.01em',
              }}
            >
              The long haul
            </div>
            <RecordList rows={stats?.slowest.slice(0, 5) ?? []} muted />
          </Card>

          <Card>
            <div className="eyebrow">Time banked</div>
            <div
              style={{
                fontFamily: 'var(--sans)',
                fontWeight: 700,
                fontSize: 22,
                marginTop: 4,
                marginBottom: 14,
                letterSpacing: '-.01em',
              }}
            >
              All together now
            </div>
            {[
              { label: 'Seconds', value: (stats?.totalSeconds ?? 0).toLocaleString() },
              { label: 'Minutes', value: ((stats?.totalSeconds ?? 0) / 60).toFixed(1) },
              { label: 'Hours', value: hours.toFixed(2) },
              { label: 'Days tracked', value: (stats?.totalDays ?? 0).toLocaleString() },
              { label: 'Longest streak', value: `${stats?.maxStreak ?? 0} days` },
            ].map(row => (
              <div
                key={row.label}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'baseline',
                  padding: '10px 0',
                  borderBottom: '1px solid var(--rule-soft)',
                }}
              >
                <span style={{ fontFamily: 'var(--mono)', fontSize: 11, color: 'var(--muted)' }}>
                  {row.label}
                </span>
                <span
                  className="tnum"
                  style={{ fontFamily: 'var(--sans)', fontWeight: 700, fontSize: 18 }}
                >
                  {row.value}
                </span>
              </div>
            ))}
          </Card>
        </div>
      </PageShell>
    </main>
  )
}

function RangePills({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div
      style={{
        display: 'flex',
        gap: 4,
        padding: 4,
        background: 'var(--surface2)',
        borderRadius: 99,
      }}
    >
      {RANGES.map(r => (
        <button
          key={r.value}
          type="button"
          onClick={() => onChange(r.value)}
          aria-pressed={value === r.value}
          style={{
            background: value === r.value ? 'var(--ink)' : 'transparent',
            color: value === r.value ? 'var(--bg)' : 'var(--muted)',
            border: 0,
            padding: '6px 12px',
            borderRadius: 99,
            fontFamily: 'var(--mono)',
            fontSize: 11,
            fontWeight: 600,
            cursor: 'pointer',
            letterSpacing: '.06em',
          }}
        >
          {r.label}
        </button>
      ))}
    </div>
  )
}

function RecordList({
  rows,
  muted = false,
}: {
  rows: { date: string; seconds: number; dow: string }[]
  muted?: boolean
}) {
  if (rows.length === 0) {
    return (
      <p className="eyebrow" style={{ margin: 0 }}>
        Nothing logged yet
      </p>
    )
  }
  return (
    <>
      {rows.map((f, i) => (
        <div
          key={f.date}
          style={{
            display: 'grid',
            gridTemplateColumns: '24px 1fr auto',
            gap: 12,
            padding: '10px 0',
            borderBottom: '1px solid var(--rule-soft)',
            alignItems: 'center',
          }}
        >
          <div className="tnum mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
            0{i + 1}
          </div>
          <div style={{ fontFamily: 'var(--sans)', fontSize: 14, fontWeight: 500 }}>
            {fmtDateShort(f.date)}
            <span style={{ color: 'var(--muted)', marginLeft: 8, fontWeight: 400 }}>{f.dow}</span>
          </div>
          <div
            className="tnum"
            style={{
              fontFamily: 'var(--sans)',
              fontWeight: 700,
              fontSize: 20,
              color: muted ? 'var(--ink)' : 'var(--accent)',
            }}
          >
            {fmtTime(f.seconds)}
          </div>
        </div>
      ))}
    </>
  )
}
