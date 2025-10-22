'use client'

import { useEffect, useMemo, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'

type PuzzleRecord = {
  date: string
  time_seconds: number
}

type DayCell = {
  date: string
  level: number
  seconds: number | null
  isActive: boolean
}

type CalendarGrid = {
  weeks: DayCell[][]
  monthLabels: string[]
}

const START_DATE = new Date(Date.UTC(2014, 7, 21)) // August is month index 7

const LEVEL_CLASSES: Record<number, string> = {
  0: 'bg-zinc-200 dark:bg-zinc-800 border border-zinc-300/40 dark:border-zinc-700/60',
  1: 'bg-emerald-200 dark:bg-emerald-950/50 border border-emerald-200/70 dark:border-emerald-900/60',
  2: 'bg-emerald-300 dark:bg-emerald-900/70 border border-emerald-300/70 dark:border-emerald-800/60',
  3: 'bg-emerald-400 dark:bg-emerald-800 border border-emerald-400/70 dark:border-emerald-700/50',
  4: 'bg-emerald-500 dark:bg-emerald-600 border border-emerald-500/70 dark:border-emerald-500/60',
}

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

  const handleDayClick = (day: DayCell) => {
    if (!day.isActive || !day.date) return
    const dt = parseDateKey(day.date)
    const year = dt.getUTCFullYear()
    const month = dt.getUTCMonth() + 1
    const dayOfMonth = dt.getUTCDate()
    const url = `https://www.nytimes.com/crosswords/game/mini/${year}/${month}/${dayOfMonth}`
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
      return <p className="text-sm text-zinc-500 dark:text-zinc-400">No data for this range.</p>
    }

    return (
      <div className="overflow-x-auto pb-2">
        <div className="ml-9 flex gap-[2px]">
          {monthLabels.map((label, index) => (
            <div
              key={`month-${index}`}
              className="h-4 w-4 text-[10px] text-zinc-500 dark:text-zinc-400"
            >
              {label}
            </div>
          ))}
        </div>
        <div className="mt-2 flex">
          <div className="mr-2 flex flex-col justify-between py-1 text-xs text-zinc-500 dark:text-zinc-400">
            <span>Sun</span>
            <span>Tue</span>
            <span>Thu</span>
            <span>Sat</span>
          </div>
          <div className="flex gap-[2px]">
            {weeks.map((week, weekIndex) => (
              <div key={`week-${weekIndex}`} className="flex flex-col gap-[2px]">
                {week.map((day, dayIndex) => (
                  <button
                    key={day.date ? `day-${day.date}` : `placeholder-${weekIndex}-${dayIndex}`}
                    type="button"
                    disabled={!day.isActive}
                    onClick={() => handleDayClick(day)}
                    className={`h-4 w-4 rounded-sm transition-colors duration-150 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-1 focus:ring-offset-white dark:focus:ring-offset-zinc-900 ${
                      day.isActive
                        ? `cursor-pointer ${LEVEL_CLASSES[day.level]}`
                        : `cursor-default opacity-40 ${LEVEL_CLASSES[0]}`
                    }`}
                    title={getTooltip(day)}
                    aria-label={getTooltip(day)}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <main className="p-8 space-y-8">
      <div>
        <h1 className="text-3xl font-bold">Tracker</h1>
        <p className="text-sm text-zinc-600 dark:text-zinc-400 mt-2">
          A contributions-style view of every NYT Mini since 21 Aug 2014.
        </p>
      </div>

      <section className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Total Completions</p>
          <p className="mt-2 text-3xl font-semibold">{totalSolved}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Days Tracked</p>
          <p className="mt-2 text-3xl font-semibold">{totalDays}</p>
        </div>
        <div className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow">
          <p className="text-sm text-zinc-500 dark:text-zinc-400">Completion Rate</p>
          <p className="mt-2 text-3xl font-semibold">{completionRate}%</p>
        </div>
      </section>

      <section className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow space-y-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-semibold">All-Time Contribution Grid</h2>
          <div className="flex items-center gap-4 text-xs text-zinc-500 dark:text-zinc-400">
            <div className="flex items-center gap-1">
              <div className={`h-3 w-3 rounded ${LEVEL_CLASSES[0]}`} />
              <span>Not logged</span>
            </div>
            <div className="flex items-center gap-1">
              <span>Slower</span>
              {[1, 2, 3, 4].map(level => (
                <div key={level} className={`h-3 w-3 rounded ${LEVEL_CLASSES[level]}`} />
              ))}
              <span>Faster</span>
            </div>
          </div>
        </div>

        {loading && <p className="text-sm text-zinc-500 dark:text-zinc-400">Loading tracker…</p>}
        {error && !loading && (
          <p className="text-sm text-red-500 dark:text-red-400">Failed to load data: {error}</p>
        )}
        {!loading && !error && renderGrid(overallWeeks, overallMonthLabels)}
      </section>

      {!loading && !error && yearlyGrids.length > 0 && (
        <section className="rounded-2xl bg-white dark:bg-zinc-900 p-6 shadow space-y-6">
          <h2 className="text-xl font-semibold">Yearly Snapshots</h2>
          <div className="space-y-6">
            {yearlyGrids.map(({ year, weeks, monthLabels }) => (
              <div key={year} className="space-y-2">
                <h3 className="text-lg font-semibold text-zinc-700 dark:text-zinc-200">{year}</h3>
                {renderGrid(weeks, monthLabels)}
              </div>
            ))}
          </div>
        </section>
      )}
    </main>
  )
}
