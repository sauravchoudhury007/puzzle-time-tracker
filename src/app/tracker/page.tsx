'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import { LAST_SELECTED_PUZZLE_DATE_KEY } from '@/lib/storageKeys'
import NavPill from '@/components/NavPill'
import {
  BASE_LEVEL_0_CLASS,
  DYNAMIC_CELL_CLASS,
  getLevelStyle,
} from '@/lib/colorUtils'

type PuzzleRecord = {
  date: string
  time_seconds: number
}

type DayCell = {
  date: string
  level: number
  seconds: number | null
  isActive: boolean
  year: number
}

type CalendarGrid = {
  weeks: DayCell[][]
  monthLabels: string[]
}

const START_DATE = new Date(Date.UTC(2014, 7, 21)) // August is month index 7



function toDateKey(date: Date): string {
  const year = date.getUTCFullYear()
  const month = (date.getUTCMonth() + 1).toString().padStart(2, '0')
  const day = date.getUTCDate().toString().padStart(2, '0')
  return `${year}-${month}-${day}`
}

function parseDateKey(key: string): Date {
  const [year, month, day] = key.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day))
}

function getTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()))
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setUTCDate(next.getUTCDate() + days)
  return next
}

function startOfWeek(date: Date): Date {
  const start = new Date(date)
  const day = start.getUTCDay()
  return addDays(start, -day)
}

function secondsToLevel(seconds: number | null): number {
  if (seconds === null) return 0
  if (seconds <= 60) return 4
  if (seconds <= 90) return 3
  if (seconds <= 120) return 2
  return 1
}

function formatSeconds(seconds: number | null): string {
  if (seconds === null) return 'No puzzle logged'
  const minutes = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

function formatDateLabel(dateKey: string, opts?: Intl.DateTimeFormatOptions): string {
  const [year, month, day] = dateKey.split('-').map(Number)
  const dt = new Date(Date.UTC(year, month - 1, day))
  return dt.toLocaleDateString(undefined, { timeZone: 'UTC', ...opts })
}

function buildCalendarGrid(start: Date, end: Date, dailyMap: Map<string, number>): CalendarGrid {
  if (start > end) {
    return { weeks: [], monthLabels: [] }
  }

  const weeks: DayCell[][] = []
  const firstWeekStart = startOfWeek(start)
  const lastWeekEnd = addDays(startOfWeek(end), 6)

  let cursor = firstWeekStart
  let currentWeek: DayCell[] = []

  while (cursor <= lastWeekEnd) {
    const key = toDateKey(cursor)
    const isActive = cursor >= start && cursor <= end
    const seconds = isActive ? dailyMap.get(key) ?? null : null
    const level = isActive ? secondsToLevel(seconds) : 0

    currentWeek.push({
      date: key,
      level,
      seconds,
      isActive,
      year: cursor.getUTCFullYear(),
    })

    if (currentWeek.length === 7) {
      weeks.push(currentWeek)
      currentWeek = []
    }

    cursor = addDays(cursor, 1)
  }

  if (currentWeek.length > 0) {
    while (currentWeek.length < 7) {
      const key = toDateKey(cursor)
      currentWeek.push({
        date: key,
        level: 0,
        seconds: null,
        isActive: false,
        year: cursor.getUTCFullYear(),
      })
      cursor = addDays(cursor, 1)
    }
    weeks.push(currentWeek)
  }

  const monthLabels: string[] = []
  let lastLabel = ''
  weeks.forEach((week, index) => {
    const activeDay = week.find(day => day.isActive)
    if (!activeDay) {
      monthLabels.push('')
      return
    }
    const dayDate = parseDateKey(activeDay.date)
    const label = dayDate.toLocaleString(undefined, { month: 'short', timeZone: 'UTC' })
    if ((index === 0 || dayDate.getUTCDate() <= 7) && label !== lastLabel) {
      monthLabels.push(label)
      lastLabel = label
    } else {
      monthLabels.push('')
    }
  })

  return { weeks, monthLabels }
}



export default function TrackerPage() {
  const [records, setRecords] = useState<PuzzleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true

    const load = async () => {
      setLoading(true)
      setError(null)
      const { data, error: fetchError } = await supabase
        .from('puzzle_times')
        .select('date, time_seconds')
        .order('date', { ascending: true })

      if (!isMounted) return

      if (fetchError) {
        setError(fetchError.message)
      } else if (data) {
        setRecords(data as PuzzleRecord[])
      }
      setLoading(false)
    }

    load()
    return () => {
      isMounted = false
    }
  }, [])

  const dailyMap = useMemo(() => {
    const map = new Map<string, number>()
    records.forEach(record => {
      const key = record.date.slice(0, 10)
      const current = map.get(key)
      if (current === undefined || record.time_seconds < current) {
        map.set(key, record.time_seconds)
      }
    })
    return map
  }, [records])

  const today = useMemo(() => getTodayUtc(), [])

  const { weeks: overallWeeks, monthLabels: overallMonthLabels } = useMemo(
    () => buildCalendarGrid(new Date(START_DATE), new Date(today), dailyMap),
    [dailyMap, today]
  )

  const yearlyGrids = useMemo(() => {
    const grids: Array<{ year: number; weeks: DayCell[][]; monthLabels: string[] }> = []
    const startYear = START_DATE.getUTCFullYear()
    const endYear = today.getUTCFullYear()

    for (let year = startYear; year <= endYear; year++) {
      const rangeStart =
        year === startYear ? new Date(START_DATE) : new Date(Date.UTC(year, 0, 1))
      const rangeEnd =
        year === endYear ? new Date(today) : new Date(Date.UTC(year, 11, 31))

      if (rangeStart > rangeEnd) continue

      const grid = buildCalendarGrid(rangeStart, rangeEnd, dailyMap)
      grids.push({ year, ...grid })
    }

    return grids
  }, [dailyMap, today])

  const totalSolved = dailyMap.size
  const totalDays = Math.max(
    1,
    Math.floor((today.getTime() - START_DATE.getTime()) / (1000 * 60 * 60 * 24)) + 1
  )
  const completionRate = ((totalSolved / totalDays) * 100).toFixed(1)
  const legendYear = Math.max(2014, today.getUTCFullYear())
  const legendStyles = [1, 2, 3, 4].map(level => getLevelStyle(legendYear, level))

  const handleDayClick = (day: DayCell) => {
    if (!day.isActive || !day.date) return
    if (typeof window !== 'undefined') {
      window.localStorage.setItem(LAST_SELECTED_PUZZLE_DATE_KEY, day.date)
    }
    const datePath = day.date.replace(/-/g, '/')
    const url = `https://www.nytimes.com/crosswords/game/mini/${datePath}`
    window.open(url, '_blank', 'noopener,noreferrer')
  }

  const getTooltip = (day: DayCell) => {
    if (!day.date) return 'Outside puzzle range'
    const dateLabel = formatDateLabel(day.date, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      weekday: 'short',
    })

    if (!day.isActive) {
      return `${dateLabel} • Outside tracker range`
    }
    return day.seconds === null
      ? `${dateLabel} • No puzzle logged`
      : `${dateLabel} • Solved in ${formatSeconds(day.seconds)}`
  }

  const renderGrid = (weeks: DayCell[][], monthLabels: string[]) => {
    if (!weeks.length) {
      return <p className="text-sm text-white/70">No data for this range.</p>
    }

    return (
      <div className="overflow-x-auto pb-2">
        <div className="ml-9 flex gap-[2px]">
          {monthLabels.map((label, index) => (
            <div
              key={`month-${index}`}
              className="h-4 w-4 text-[10px] text-white/50"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="mt-2 flex">
          <div className="mr-2 flex flex-col justify-between py-1 text-xs text-white/60">
            <span>Sun</span>
            <span>Tue</span>
            <span>Thu</span>
            <span>Sat</span>
          </div>
          <div className="flex gap-[2px]">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="flex flex-col gap-[2px]">
                {week.map((day, dayIndex) => {
                  const isActive = day.isActive && day.level > 0
                  const className = isActive
                    ? DYNAMIC_CELL_CLASS
                    : BASE_LEVEL_0_CLASS
                  const stateClass = day.isActive ? 'cursor-pointer' : 'cursor-default opacity-40'
                  const style = isActive ? getLevelStyle(day.year, day.level) : {}

                  return (
                    <button
                      key={day.date ? `day-${day.date}` : `placeholder-${weekIndex}-${dayIndex}`}
                      type="button"
                      disabled={!day.isActive}
                      onClick={() => handleDayClick(day)}
                      style={style}
                      className={`h-4 w-4 rounded-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-[#050b1c] ${stateClass} ${className}`}
                      title={getTooltip(day)}
                      aria-label={getTooltip(day)}
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

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl space-y-8 px-5 py-16">
      <div>
        <NavPill currentHref="/tracker" />
        <h1 className="mt-3 text-3xl font-extrabold text-white md:text-4xl">Puzzle streak map</h1>
      </div>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <p className="text-sm uppercase tracking-[0.16em] text-white/60">Total Completions</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalSolved}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <p className="text-sm uppercase tracking-[0.16em] text-white/60">Days Tracked</p>
          <p className="mt-3 text-3xl font-semibold text-white">{totalDays}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <p className="text-sm uppercase tracking-[0.16em] text-white/60">Completion Rate</p>
          <p className="mt-3 text-3xl font-semibold text-white">{completionRate}%</p>
        </div>
      </section>

      <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold text-white">All-Time Contribution Grid</h2>
          <div className="flex flex-col gap-2 text-xs text-white/70 sm:flex-row sm:items-center">
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded ${BASE_LEVEL_0_CLASS}`} />
              <span>Not logged</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Slower</span>
              {legendStyles.map((style, idx) => (
                <div
                  key={`legend-${idx}`}
                  style={style}
                  className={`h-3 w-3 rounded ${DYNAMIC_CELL_CLASS}`}
                />
              ))}
              <span>Faster</span>
            </div>
            <span className="sm:ml-2 text-white/60">Legend shown for {legendYear}</span>
          </div>
        </div>
        {loading && <p className="text-sm text-white/70">Loading tracker…</p>}
        {error && !loading && (
          <p className="text-sm text-rose-300">Failed to load data: {error}</p>
        )}
        {!loading && !error && renderGrid(overallWeeks, overallMonthLabels)}
      </section>

      {!loading && !error && yearlyGrids.length > 0 && (
        <section className="space-y-6 rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <h2 className="text-xl font-semibold text-white">Yearly Snapshots</h2>
          <div className="space-y-6">
            {yearlyGrids.map(({ year, weeks, monthLabels }) => (
              <div key={year} className="space-y-2">
                <h3 className="text-lg font-semibold text-white">{year}</h3>
                {renderGrid(weeks, monthLabels)}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
