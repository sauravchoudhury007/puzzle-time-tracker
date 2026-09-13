'use client'

import { useEffect, useMemo, useRef } from 'react'
import { addDays, parseDateKey, toDateKey } from '@/lib/dateUtils'
import { fmtTime } from '@/lib/format'
import { yearCellVars } from '@/lib/colorUtils'

/** `pulse` is the single lime ramp; `year` gives every year its own hue. */
export type HeatPalette = 'pulse' | 'year'

export type HeatCell = {
  date: string
  /** 0 = nothing logged, 1 = slowest … 4 = fastest */
  level: number
  seconds: number | null
  /** False for the padding days that square off the first and last week. */
  inRange: boolean
}

/** App calibration: how a solve time maps onto the 4 lit levels. */
export function secondsToLevel(seconds: number | null): number {
  if (seconds === null) return 0
  if (seconds <= 60) return 4
  if (seconds <= 90) return 3
  if (seconds <= 120) return 2
  return 1
}

function startOfWeek(date: Date): Date {
  return addDays(date, -date.getUTCDay())
}

export function buildWeeks(start: Date, end: Date, times: Map<string, number>): HeatCell[][] {
  if (start > end) return []
  const weeks: HeatCell[][] = []
  let cursor = startOfWeek(start)
  const last = addDays(startOfWeek(end), 6)
  let week: HeatCell[] = []

  while (cursor <= last) {
    const date = toDateKey(cursor)
    const inRange = cursor >= start && cursor <= end
    const seconds = inRange ? times.get(date) ?? null : null
    week.push({ date, inRange, seconds, level: inRange ? secondsToLevel(seconds) : 0 })
    if (week.length === 7) {
      weeks.push(week)
      week = []
    }
    cursor = addDays(cursor, 1)
  }
  if (week.length) {
    while (week.length < 7) {
      week.push({ date: '', inRange: false, seconds: null, level: 0 })
    }
    weeks.push(week)
  }
  return weeks
}

function monthLabels(weeks: HeatCell[][]): string[] {
  const labels: string[] = []
  let lastMonth = -1
  weeks.forEach(week => {
    const first = week.find(c => c.inRange)
    if (!first) {
      labels.push('')
      return
    }
    const d = parseDateKey(first.date)
    const m = d.getUTCMonth()
    if (m !== lastMonth && d.getUTCDate() <= 7) {
      labels.push(d.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' }))
      lastMonth = m
    } else {
      labels.push('')
    }
  })
  return labels
}

export default function Heatmap({
  start,
  end,
  times,
  size = 14,
  gap = 3,
  palette = 'pulse',
  onSelect,
}: {
  start: Date
  end: Date
  times: Map<string, number>
  size?: number
  gap?: number
  palette?: HeatPalette
  onSelect?: (cell: HeatCell) => void
}) {
  const weeks = useMemo(() => buildWeeks(start, end, times), [start, end, times])
  const labels = useMemo(() => monthLabels(weeks), [weeks])
  const scrollRef = useRef<HTMLDivElement | null>(null)

  // A multi-year grid overflows; open it on the most recent weeks like GitHub does.
  useEffect(() => {
    const el = scrollRef.current
    if (el) el.scrollLeft = el.scrollWidth
  }, [weeks])

  if (weeks.length === 0) {
    return (
      <p className="eyebrow" style={{ margin: 0 }}>
        No data for this range
      </p>
    )
  }

  return (
    <div ref={scrollRef} style={{ overflowX: 'auto', paddingBottom: 4 }}>
      <div style={{ minWidth: 'min-content' }}>
        <div
          style={{
            display: 'flex',
            gap: `0 ${gap}px`,
            marginLeft: 30,
            marginBottom: 4,
            fontSize: 10,
            color: 'var(--muted)',
            letterSpacing: '.06em',
            fontFamily: 'var(--sans)',
          }}
        >
          {labels.map((label, i) => (
            <div key={i} style={{ width: size, flex: '0 0 auto' }}>
              {label}
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: `0 ${gap}px` }}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap,
              marginRight: 6,
              fontSize: 10,
              color: 'var(--muted)',
              flex: '0 0 auto',
            }}
          >
            {['', 'Mon', '', 'Wed', '', 'Fri', ''].map((d, i) => (
              <div key={i} style={{ height: size, lineHeight: `${size}px` }}>
                {d}
              </div>
            ))}
          </div>

          {weeks.map((week, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap, flex: '0 0 auto' }}>
              {week.map((cell, j) => {
                const interactive = Boolean(onSelect && cell.inRange && cell.date)
                const title = !cell.date
                  ? ''
                  : cell.inRange
                    ? `${cell.date} • ${cell.seconds != null ? fmtTime(cell.seconds) : 'no log'}`
                    : `${cell.date} • outside range`
                const lit = cell.inRange && cell.level > 0
                const useYearHue = palette === 'year' && lit
                return (
                  <button
                    key={cell.date || `pad-${i}-${j}`}
                    type="button"
                    className={useYearHue ? 'hm-cell hm-year' : 'hm-cell'}
                    disabled={!interactive}
                    onClick={interactive ? () => onSelect?.(cell) : undefined}
                    title={title}
                    aria-label={title || undefined}
                    style={{
                      width: size,
                      height: size,
                      padding: 0,
                      border: 0,
                      opacity: cell.inRange ? 1 : 0.25,
                      borderRadius: 'var(--cell-r)',
                      cursor: interactive ? 'pointer' : 'default',
                      ...(useYearHue
                        ? yearCellVars(Number(cell.date.slice(0, 4)), cell.level)
                        : { background: `var(--hm-${cell.inRange ? cell.level : 0})` }),
                    }}
                  />
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

/** Pass `year` to show that year's hue ramp instead of the Pulse lime one. */
export function HeatmapLegend({ year }: { year?: number }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 6,
        fontSize: 10,
        color: 'var(--muted)',
        letterSpacing: '.06em',
        textTransform: 'uppercase',
        fontFamily: 'var(--mono)',
      }}
    >
      <span>slower</span>
      {[1, 2, 3, 4].map(l => (
        <div
          key={l}
          className={year != null ? 'hm-year' : undefined}
          style={{
            width: 10,
            height: 10,
            borderRadius: 'var(--cell-r)',
            ...(year != null ? yearCellVars(year, l) : { background: `var(--hm-${l})` }),
          }}
        />
      ))}
      <span>faster</span>
    </div>
  )
}
