'use client'

import { memo, useMemo } from 'react'
import { buildWeeks, secondsToLevel } from '@/components/pulse/Heatmap'
import { yearCellBorder, yearCellColor } from '@/lib/colorUtils'
import { fmtTime } from '@/lib/format'
import type { PuzzleStats } from '@/lib/puzzleStats'

/* A print-ready poster of the whole archive, one hue per year.
   Sized in CSS pixels at 96dpi so `@page` can match it exactly; the Frame page
   scales it down for screen with a transform. Colours are literal rather than
   themed — a print does not follow the reader's dark mode. */

export type PaperKey = 'a4' | 'letter' | 'a3' | 'a2' | 'square'
export type PosterLayout = 'grid' | 'ribbon'
export type PosterInk = 'paper' | 'ink'

/* Widths/heights are CSS px at 96dpi, kept a couple of px under the true sheet so
   rounding can never push the poster onto a second page. */
export const PAPERS: Record<
  PaperKey,
  { label: string; width: number; height: number; cssSize: string }
> = {
  a4: { label: 'A4', width: 792, height: 1121, cssSize: 'A4 portrait' },
  letter: { label: 'Letter', width: 814, height: 1054, cssSize: 'Letter portrait' },
  a3: { label: 'A3', width: 1120, height: 1585, cssSize: 'A3 portrait' },
  a2: { label: 'A2', width: 1585, height: 2243, cssSize: 'A2 portrait' },
  square: { label: 'Square', width: 1198, height: 1198, cssSize: '12.5in 12.5in' },
}

const INKS: Record<PosterInk, { bg: string; ink: string; muted: string; scheme: 'light' | 'dark'; empty: string }> = {
  paper: { bg: '#faf9f6', ink: '#141310', muted: '#8b8980', scheme: 'light', empty: '#ebe9e3' },
  ink: { bg: '#0b0b09', ink: '#f3f3ee', muted: '#78776e', scheme: 'dark', empty: '#1b1b18' },
}

export type PosterOptions = {
  layout: PosterLayout
  paper: PaperKey
  ink: PosterInk
  title: string
  subtitle: string
  showStats: boolean
  showLegend: boolean
}

export default function Poster({
  stats,
  options,
  id = 'poster',
}: {
  stats: PuzzleStats
  options: PosterOptions
  id?: string
}) {
  const paper = PAPERS[options.paper]
  const tone = INKS[options.ink]

  const years = useMemo(() => {
    const first = stats.startDate.getUTCFullYear()
    const last = stats.endDate.getUTCFullYear()
    const out: { year: number; start: Date; end: Date }[] = []
    for (let y = first; y <= last; y++) {
      const start = y === first ? stats.startDate : new Date(Date.UTC(y, 0, 1))
      const yearEnd = new Date(Date.UTC(y, 11, 31))
      const end = yearEnd > stats.endDate ? stats.endDate : yearEnd
      if (start <= end) out.push({ year: y, start, end })
    }
    return out
  }, [stats])

  const margin = Math.round(paper.width * 0.085)
  const contentW = paper.width - margin * 2
  const labelW = Math.round(contentW * 0.06)
  const headerH = Math.round(paper.height * 0.13)
  const footerH = options.showStats || options.showLegend ? Math.round(paper.height * 0.09) : 0
  const artH = paper.height - margin * 2 - headerH - footerH

  return (
    <div
      id={id}
      className="poster"
      style={{
        width: paper.width,
        height: paper.height,
        background: tone.bg,
        color: tone.ink,
        padding: margin,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        overflow: 'hidden',
      }}
    >
      {/* ── Header ─────────────────────────────────────── */}
      <header style={{ height: headerH, flex: '0 0 auto' }}>
        <div
          style={{
            fontFamily: 'var(--mono)',
            fontSize: Math.round(paper.width * 0.0125),
            letterSpacing: '.3em',
            textTransform: 'uppercase',
            color: tone.muted,
          }}
        >
          {options.subtitle}
        </div>
        <div
          style={{
            fontFamily: 'var(--serif)',
            fontStyle: 'italic',
            fontSize: Math.round(paper.width * 0.072),
            lineHeight: 1.02,
            letterSpacing: '-.03em',
            marginTop: Math.round(paper.height * 0.012),
          }}
        >
          {options.title}
        </div>
        <div
          style={{
            height: 1,
            background: tone.ink,
            opacity: 0.25,
            marginTop: Math.round(paper.height * 0.018),
          }}
        />
      </header>

      {/* ── Artwork ────────────────────────────────────── */}
      <div
        style={{
          flex: '1 1 auto',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          // On tall-constrained sheets the art is narrower than the page; centre it.
          alignItems: 'center',
          minHeight: 0,
        }}
      >
        {options.layout === 'grid' ? (
          <GridArt
            years={years}
            stats={stats}
            tone={tone}
            contentW={contentW}
            labelW={labelW}
            availH={artH}
            paperW={paper.width}
          />
        ) : (
          <RibbonArt
            years={years}
            stats={stats}
            tone={tone}
            contentW={contentW}
            labelW={labelW}
            availH={artH}
            paperW={paper.width}
          />
        )}
      </div>

      {/* ── Footer ─────────────────────────────────────── */}
      {footerH > 0 && (
        <footer
          style={{
            height: footerH,
            flex: '0 0 auto',
            display: 'flex',
            alignItems: 'flex-end',
            justifyContent: 'space-between',
            gap: 24,
          }}
        >
          {options.showStats ? (
            <div style={{ display: 'flex', gap: Math.round(paper.width * 0.045) }}>
              {[
                { label: 'Solved', value: stats.solvedCount.toLocaleString() },
                { label: 'Hours', value: (stats.totalSeconds / 3600).toFixed(0) },
                { label: 'Best', value: fmtTime(stats.best) },
                { label: 'Longest streak', value: `${stats.maxStreak}d` },
              ].map(s => (
                <div key={s.label}>
                  <div
                    style={{
                      fontFamily: 'var(--mono)',
                      fontSize: Math.round(paper.width * 0.0095),
                      letterSpacing: '.2em',
                      textTransform: 'uppercase',
                      color: tone.muted,
                    }}
                  >
                    {s.label}
                  </div>
                  <div
                    style={{
                      fontFamily: 'var(--sans)',
                      fontWeight: 700,
                      fontSize: Math.round(paper.width * 0.026),
                      letterSpacing: '-.02em',
                      fontFeatureSettings: '"tnum","lnum"',
                      marginTop: 2,
                    }}
                  >
                    {s.value}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div />
          )}

          {options.showLegend && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                fontFamily: 'var(--mono)',
                fontSize: Math.round(paper.width * 0.0095),
                letterSpacing: '.14em',
                textTransform: 'uppercase',
                color: tone.muted,
              }}
            >
              <span>slower</span>
              {[1, 2, 3, 4].map(level => (
                <span
                  key={level}
                  style={{
                    width: Math.round(paper.width * 0.012),
                    height: Math.round(paper.width * 0.012),
                    background: yearCellColor(stats.endDate.getUTCFullYear(), level, tone.scheme),
                    display: 'inline-block',
                  }}
                />
              ))}
              <span>faster</span>
            </div>
          )}
        </footer>
      )}
    </div>
  )
}

type ArtProps = {
  years: { year: number; start: Date; end: Date }[]
  stats: PuzzleStats
  tone: (typeof INKS)[PosterInk]
  contentW: number
  labelW: number
  availH: number
  paperW: number
}

/** Every year as its own 7×53 block, stacked. Memoized, like RibbonArt: editing the
 *  poster's wording should not redraw thousands of cells. */
const GridArt = memo(function GridArt({
  years,
  stats,
  tone,
  contentW,
  labelW,
  availH,
  paperW,
}: ArtProps) {
  const gridW = contentW - labelW
  const stepFromWidth = gridW / 53
  // 7 rows per year plus 1.8 rows of air between years.
  const rowsTotal = years.length * 7 + Math.max(0, years.length - 1) * 1.8
  const stepFromHeight = availH / rowsTotal
  const step = Math.min(stepFromWidth, stepFromHeight)
  const cell = step * 0.84
  const gap = step - cell
  const blockGap = step * 1.8

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: blockGap }}>
      {years.map(({ year, start, end }) => {
        const weeks = buildWeeks(start, end, stats.times)
        return (
          <div key={year} style={{ display: 'flex', alignItems: 'flex-start', gap: labelW * 0.25 }}>
            <div
              style={{
                width: labelW,
                flex: '0 0 auto',
                fontFamily: 'var(--mono)',
                fontSize: Math.max(7, Math.round(paperW * 0.0115)),
                fontWeight: 600,
                letterSpacing: '.06em',
                color: yearCellColor(year, 4, tone.scheme),
                paddingTop: 1,
              }}
            >
              {year}
            </div>
            <div style={{ display: 'flex', gap }}>
              {weeks.map((week, i) => (
                <div key={i} style={{ display: 'flex', flexDirection: 'column', gap }}>
                  {week.map((c, j) => (
                    <div
                      key={c.date || `p-${i}-${j}`}
                      style={{
                        width: cell,
                        height: cell,
                        background:
                          c.inRange && c.level > 0
                            ? yearCellColor(year, c.level, tone.scheme)
                            : tone.empty,
                        opacity: c.inRange ? 1 : 0.35,
                      }}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        )
      })}
    </div>
  )
})

/** Every year as one continuous line of days — more abstract, more graphic. */
const RibbonArt = memo(function RibbonArt({
  years,
  stats,
  tone,
  contentW,
  labelW,
  availH,
  paperW,
}: ArtProps) {
  const laneW = contentW - labelW
  const barW = laneW / 366
  const rowsTotal = years.length + Math.max(0, years.length - 1) * 0.45
  const laneH = Math.min(availH / rowsTotal, paperW * 0.055)
  const laneGap = laneH * 0.45

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: laneGap }}>
      {years.map(({ year }) => {
        const days = stats.days.filter(d => d.date.startsWith(`${year}-`))
        return (
          <div key={year} style={{ display: 'flex', alignItems: 'center', gap: labelW * 0.25 }}>
            <div
              style={{
                width: labelW,
                flex: '0 0 auto',
                fontFamily: 'var(--mono)',
                fontSize: Math.max(7, Math.round(paperW * 0.0115)),
                fontWeight: 600,
                letterSpacing: '.06em',
                color: yearCellColor(year, 4, tone.scheme),
              }}
            >
              {year}
            </div>
            <div style={{ display: 'flex', height: laneH, width: laneW }}>
              {days.map(d => {
                const level = secondsToLevel(d.seconds)
                return (
                  <div
                    key={d.date}
                    style={{
                      width: barW,
                      height: '100%',
                      background:
                        level > 0 ? yearCellColor(year, level, tone.scheme) : tone.empty,
                      // A hairline keeps adjacent fast days from merging into a slab.
                      borderRight:
                        level > 0 ? `0.5px solid ${yearCellBorder(year, level, tone.scheme)}` : 'none',
                    }}
                  />
                )
              })}
            </div>
          </div>
        )
      })}
    </div>
  )
})
