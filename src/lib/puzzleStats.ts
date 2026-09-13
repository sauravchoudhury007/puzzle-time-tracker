import { addDays, toDateKey } from '@/lib/dateUtils'
import { dayOfWeek } from '@/lib/format'

/** The day tracking started — anchors completion rate and the all-time grid. */
export const TRACKER_START = new Date(Date.UTC(2014, 7, 21))

export type PuzzleRow = { date: string; time_seconds: number }

export type Day = { date: string; seconds: number | null; dow: string }
export type SolvedDay = { date: string; seconds: number; dow: string }
export type MonthPoint = { month: string; avg: number }
export type DowStat = { day: string; avg: number }
export type Bucket = { label: string; count: number; percent: number }

export type PuzzleStats = {
  /** One entry per calendar day from tracking start to today. */
  days: Day[]
  solved: SolvedDay[]
  /** date → fastest logged seconds, for the heatmap. */
  times: Map<string, number>
  solvedCount: number
  totalDays: number
  completion: number
  totalSeconds: number
  avg: number
  best: number | null
  curStreak: number
  maxStreak: number
  monthly: MonthPoint[]
  /** 30-day rolling average aligned to `monthly`. */
  monthlyRolling: (number | null)[]
  weekly: MonthPoint[]
  dowStats: DowStat[]
  buckets: Bucket[]
  fastest: SolvedDay[]
  slowest: SolvedDay[]
  today: Day | null
  startDate: Date
  endDate: Date
}

export function getTodayUtc(): Date {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()))
}

const BUCKET_DEFS: { label: string; max: number }[] = [
  { label: '<1m', max: 60 },
  { label: '1–2m', max: 120 },
  { label: '2–3m', max: 180 },
  { label: '3–4m', max: 240 },
  { label: '4–5m', max: 300 },
  { label: '>5m', max: Infinity },
]

export function buildStats(rows: PuzzleRow[]): PuzzleStats {
  const today = getTodayUtc()

  // Keep the fastest time when a date somehow has more than one row.
  const times = new Map<string, number>()
  rows.forEach(row => {
    const key = row.date.slice(0, 10)
    const current = times.get(key)
    if (current === undefined || row.time_seconds < current) times.set(key, row.time_seconds)
  })

  const firstLogged = [...times.keys()].sort()[0]
  const start =
    firstLogged && new Date(`${firstLogged}T00:00:00Z`) < TRACKER_START
      ? new Date(`${firstLogged}T00:00:00Z`)
      : TRACKER_START

  const days: Day[] = []
  for (let cursor = new Date(start); cursor <= today; cursor = addDays(cursor, 1)) {
    const date = toDateKey(cursor)
    days.push({ date, seconds: times.get(date) ?? null, dow: dayOfWeek(date) })
  }

  const solved: SolvedDay[] = days
    .filter((d): d is Day & { seconds: number } => d.seconds != null)
    .map(d => ({ date: d.date, seconds: d.seconds, dow: d.dow }))

  const totalSeconds = solved.reduce((s, d) => s + d.seconds, 0)
  const avg = solved.length ? totalSeconds / solved.length : 0
  const best = solved.length ? Math.min(...solved.map(d => d.seconds)) : null

  // Streaks
  let maxStreak = 0
  let run = 0
  days.forEach(d => {
    if (d.seconds != null) {
      run += 1
      if (run > maxStreak) maxStreak = run
    } else {
      run = 0
    }
  })

  // Current streak counts back from today; an unlogged today does not break it yet.
  let curStreak = 0
  for (let i = days.length - 1; i >= 0; i--) {
    if (days[i].seconds != null) curStreak += 1
    else if (i === days.length - 1) continue
    else break
  }

  // Monthly averages
  const monthSums = new Map<string, { sum: number; n: number }>()
  solved.forEach(d => {
    const key = d.date.slice(0, 7)
    const entry = monthSums.get(key) ?? { sum: 0, n: 0 }
    entry.sum += d.seconds
    entry.n += 1
    monthSums.set(key, entry)
  })
  const monthly: MonthPoint[] = [...monthSums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, avg: v.sum / v.n }))

  // 3-month rolling average over the monthly series
  const monthlyRolling: (number | null)[] = monthly.map((_, i) => {
    if (i < 2) return null
    const window = monthly.slice(i - 2, i + 1)
    return window.reduce((s, m) => s + m.avg, 0) / window.length
  })

  // Weekly averages, keyed by the Sunday that starts the week
  const weekSums = new Map<string, { sum: number; n: number }>()
  solved.forEach(d => {
    const dt = new Date(`${d.date}T00:00:00Z`)
    const key = toDateKey(addDays(dt, -dt.getUTCDay()))
    const entry = weekSums.get(key) ?? { sum: 0, n: 0 }
    entry.sum += d.seconds
    entry.n += 1
    weekSums.set(key, entry)
  })
  const weekly: MonthPoint[] = [...weekSums.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({ month, avg: v.sum / v.n }))

  // Day-of-week averages, Monday first
  const dowSums = Array.from({ length: 7 }, () => ({ sum: 0, n: 0 }))
  solved.forEach(d => {
    const idx = new Date(`${d.date}T00:00:00Z`).getUTCDay()
    dowSums[idx].sum += d.seconds
    dowSums[idx].n += 1
  })
  const names = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const dowStats: DowStat[] = [1, 2, 3, 4, 5, 6, 0].map(i => ({
    day: names[i],
    avg: dowSums[i].n ? dowSums[i].sum / dowSums[i].n : 0,
  }))

  // Distribution
  const counts = BUCKET_DEFS.map(() => 0)
  solved.forEach(d => {
    const idx = BUCKET_DEFS.findIndex(b => d.seconds <= b.max)
    counts[idx === -1 ? BUCKET_DEFS.length - 1 : idx] += 1
  })
  const buckets: Bucket[] = BUCKET_DEFS.map((b, i) => ({
    label: b.label,
    count: counts[i],
    percent: solved.length ? (counts[i] / solved.length) * 100 : 0,
  }))

  const bySpeed = [...solved].sort((a, b) => a.seconds - b.seconds)

  return {
    days,
    solved,
    times,
    solvedCount: solved.length,
    totalDays: days.length,
    completion: days.length ? solved.length / days.length : 0,
    totalSeconds,
    avg,
    best,
    curStreak,
    maxStreak,
    monthly,
    monthlyRolling,
    weekly,
    dowStats,
    buckets,
    fastest: bySpeed.slice(0, 10),
    slowest: [...bySpeed].reverse().slice(0, 10),
    today: days.length ? days[days.length - 1] : null,
    startDate: start,
    endDate: today,
  }
}

/** Filter a month/week series to a trailing window. */
export function filterByRange<T extends { month: string }>(series: T[], range: string): T[] {
  if (range === 'all') return series
  const cutoff = getTodayUtc()
  if (range === '1m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 1)
  else if (range === '3m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)
  else if (range === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
  else if (range === '1y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
  const key = toDateKey(cutoff)
  return series.filter(item => item.month >= key.slice(0, item.month.length))
}
