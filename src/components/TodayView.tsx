'use client'

import Link from 'next/link'
import NavBar from '@/components/pulse/NavBar'
import CoverflowCarousel, { type Photo } from '@/components/pulse/CoverflowCarousel'
import { Card, PageShell, Stat, TickerBar } from '@/components/pulse/Surface'
import { usePuzzleTimes } from '@/hooks/usePuzzleTimes'
import { fmtDateLong, fmtTime, todayIso } from '@/lib/format'

export default function TodayView({ photos }: { photos: Photo[] }) {
  const { stats, error } = usePuzzleTimes()

  const recent = stats ? stats.days.slice(-7) : []
  const recentSolved = recent.filter(d => d.seconds != null)
  const weekAvg = recentSolved.length
    ? Math.round(recentSolved.reduce((s, d) => s + (d.seconds as number), 0) / recentSolved.length)
    : null
  const fastestDay = recentSolved.length
    ? recentSolved.reduce((a, b) => ((a.seconds as number) < (b.seconds as number) ? a : b))
    : null

  return (
    <main style={{ background: 'var(--bg)', color: 'var(--ink)', minHeight: '100vh' }}>
      <NavBar />

      <TickerBar>
        <span>● Live · Solve #{(stats?.solvedCount ?? 0).toLocaleString()}</span>
        <span>{fmtDateLong(todayIso())}</span>
        <span>Day {stats?.curStreak ?? 0} of streak</span>
      </TickerBar>

      <PageShell maxWidth={1280}>
        {error && (
          <p style={{ color: 'var(--negative)', fontFamily: 'var(--mono)', fontSize: 13 }}>
            Could not load your times: {error}
          </p>
        )}

        {/* ── Centred photo reel ───────────────────────────── */}
        {photos.length > 0 && (
          <div
            style={{
              padding: '30px 0 40px',
              borderBottom: '1px solid var(--rule-soft)',
              textAlign: 'center',
            }}
          >
            <div className="eyebrow" style={{ marginBottom: 30 }}>
              Highlight reel
            </div>
            <CoverflowCarousel photos={photos} cardW={440} cardH={500} spread={260} depth={320} />
          </div>
        )}

        {/* ── Last 7 days + headline stats ─────────────────── */}
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))',
            gap: 40,
            marginTop: 36,
            alignItems: 'start',
          }}
        >
          <Card>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'baseline',
                marginBottom: 18,
                gap: 12,
              }}
            >
              <div className="eyebrow">Last 7 days</div>
              <Link
                href="/dashboard"
                style={{
                  color: 'var(--accent)',
                  fontFamily: 'var(--mono)',
                  fontSize: 11,
                  letterSpacing: '.2em',
                }}
              >
                Full almanac →
              </Link>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(7, 1fr)',
                gap: 8,
                alignItems: 'end',
                height: 150,
              }}
            >
              {recent.map((d, i) => {
                const isToday = i === recent.length - 1
                // Faster solves draw taller, so the bars read as "better".
                const h =
                  d.seconds == null ? 4 : Math.max(8, Math.min(130, (1 - d.seconds / 180) * 130))
                return (
                  <div
                    key={d.date}
                    style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}
                  >
                    <div className="tnum mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                      {d.seconds == null ? '—' : fmtTime(d.seconds)}
                    </div>
                    <div
                      style={{
                        width: '100%',
                        height: h,
                        background:
                          d.seconds == null ? 'transparent' : isToday ? 'var(--accent)' : 'var(--ink)',
                        border: d.seconds == null ? '1px dashed var(--rule-soft)' : 0,
                        borderRadius: 2,
                        opacity: d.seconds == null ? 0.35 : isToday ? 1 : 0.35 + i * 0.07,
                      }}
                    />
                    <div style={{ fontSize: 10, color: 'var(--muted)', fontFamily: 'var(--mono)' }}>
                      {d.dow.toUpperCase()}
                    </div>
                  </div>
                )
              })}
            </div>

            <div
              style={{
                marginTop: 16,
                fontFamily: 'var(--sans)',
                fontSize: 13,
                color: 'var(--muted)',
                lineHeight: 1.5,
              }}
            >
              {weekAvg != null ? (
                <>
                  Week average: <b className="tnum" style={{ color: 'var(--ink)' }}>{fmtTime(weekAvg)}</b>
                  {fastestDay && (
                    <>
                      . Fastest day of the week:{' '}
                      <b style={{ color: 'var(--ink)' }}>{fastestDay.dow}</b>
                    </>
                  )}
                  .
                </>
              ) : (
                'Nothing logged in the last seven days.'
              )}
            </div>
          </Card>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Stat label="Streak" value={stats?.curStreak ?? 0} unit="days" accent size={32} />
            <Stat
              label="Solved"
              value={(stats?.solvedCount ?? 0).toLocaleString()}
              unit="puzzles"
              size={32}
            />
            <Stat label="Best ever" value={fmtTime(stats?.best ?? null)} unit="pair time" size={32} />
            <Stat
              label="All-time avg"
              value={stats ? fmtTime(Math.round(stats.avg)) : '—'}
              unit="across all minis"
              size={32}
            />
          </div>
        </div>
      </PageShell>
    </main>
  )
}
