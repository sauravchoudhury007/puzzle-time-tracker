'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabaseClient'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  BarChart,
  Bar,
  Cell,
} from 'recharts'
import NavPill from '@/components/NavPill'

interface Summary {
  total_puzzles: number
  avg_time_seconds: number
}

interface TimeBucket {
  period: string
  avg_time_seconds: number
  moving_avg_7?: number
  moving_avg_30?: number
}

interface PuzzleTime {
  date: string
  time_seconds: number
}

interface DistributionBucket {
  label: string
  percent: number
  count: number
}

interface DayOfWeekBucket {
  day: string
  avg_time_seconds: number
}

interface DashboardData {
  summary: Summary | null
  weekly: TimeBucket[]
  monthly: TimeBucket[]
  topFastest: PuzzleTime[]
  topSlowest: PuzzleTime[]
  distribution: DistributionBucket[]
  dayOfWeekStats: DayOfWeekBucket[]
  totalSeconds: number
}

let cachedDashboardData: DashboardData | null = null
let dashboardFetchPromise: Promise<DashboardData> | null = null

async function fetchDashboardData(): Promise<DashboardData> {
  const { data: sum } = await supabase
    .from('user_stats_all_time')
    .select('*')
    .single()

  const { data: wk } = await supabase
    .from('user_weekly_stats')
    .select('week_start, avg_time_seconds')
    .order('week_start', { ascending: true })

  const weekly: TimeBucket[] = (wk || []).map(item => ({
    period: String(item.week_start).slice(0, 10),
    avg_time_seconds: item.avg_time_seconds,
  }))

  const { data: mo } = await supabase
    .from('user_monthly_stats')
    .select('month_start, avg_time_seconds')
    .order('month_start', { ascending: true })

  const monthly: TimeBucket[] = (mo || []).map(item => ({
    period: String(item.month_start).slice(0, 10),
    avg_time_seconds: item.avg_time_seconds,
  }))

  const { data: allTimes } = await supabase
    .from('puzzle_times')
    .select('date, time_seconds')
    .order('date', { ascending: true })

  // Calculate moving averages for weekly buckets
  if (allTimes && allTimes.length > 0) {
    weekly.forEach((wkBucket) => {
      const bucketDate = new Date(wkBucket.period)
      // 7-day window ending at bucket start
      const windowStart = new Date(bucketDate)
      windowStart.setUTCDate(windowStart.getUTCDate() - 6)
      
      const inWindow = allTimes.filter((t) => {
          const d = new Date(t.date)
          return d >= windowStart && d <= bucketDate
      })
      
      if (inWindow.length > 0) {
          const sum = inWindow.reduce((acc, curr) => acc + curr.time_seconds, 0)
          wkBucket.moving_avg_7 = sum / inWindow.length
      }

      // 30-day window ending at bucket start
      const windowStart30 = new Date(bucketDate)
      windowStart30.setUTCDate(windowStart30.getUTCDate() - 29)
      
      const inWindow30 = allTimes.filter((t) => {
          const d = new Date(t.date)
          return d >= windowStart30 && d <= bucketDate
      })
      
      if (inWindow30.length > 0) {
          const sum = inWindow30.reduce((acc, curr) => acc + curr.time_seconds, 0)
          wkBucket.moving_avg_30 = sum / inWindow30.length
      }
    })
    
     monthly.forEach((moBucket) => {
      const bucketDate = new Date(moBucket.period)
      // 30-day window ending at bucket start
      const windowStart30 = new Date(bucketDate)
      windowStart30.setUTCDate(windowStart30.getUTCDate() - 29)
      
      const inWindow30 = allTimes.filter((t) => {
          const d = new Date(t.date)
          return d >= windowStart30 && d <= bucketDate
      })
      
      if (inWindow30.length > 0) {
          const sum = inWindow30.reduce((acc, curr) => acc + curr.time_seconds, 0)
          moBucket.moving_avg_30 = sum / inWindow30.length
      }
    })
  }

  const { data: fastest } = await supabase
    .from('puzzle_times')
    .select('date, time_seconds')
    .order('time_seconds', { ascending: true })
    .limit(10)

  const { data: slowest } = await supabase
    .from('puzzle_times')
    .select('date, time_seconds')
    .order('time_seconds', { ascending: false })
    .limit(10)

  let totalSeconds = 0
  let dayOfWeekStats: DayOfWeekBucket[] = []
  let distribution: DistributionBucket[] = []

  if (allTimes) {
    const dowSums = [0, 0, 0, 0, 0, 0, 0] // Sun-Sat
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]

    const counts = {
      '<1': 0,
      '1-2': 0,
      '2-3': 0,
      '3-4': 0,
      '4-5': 0,
      '>5': 0,
    }

    allTimes.forEach(item => {
      totalSeconds += item.time_seconds
      
      // Calculate DOW (Date parses as UTC midnight correctly if format is YYYY-MM-DD)
      const d = new Date(item.date)
      if (!isNaN(d.getTime())) {
          const day = d.getUTCDay()
          dowSums[day] += item.time_seconds
          dowCounts[day]++
      }

      const s = item.time_seconds
      if (s <= 60) counts['<1']++
      else if (s <= 120) counts['1-2']++
      else if (s <= 180) counts['2-3']++
      else if (s <= 240) counts['3-4']++
      else if (s <= 300) counts['4-5']++
      else counts['>5']++
    })

    const total = allTimes.length
    distribution = [
      { label: '< 1 min', percent: (counts['<1'] / total) * 100, count: counts['<1'] },
      { label: '1 – 2 min', percent: (counts['1-2'] / total) * 100, count: counts['1-2'] },
      { label: '2 – 3 min', percent: (counts['2-3'] / total) * 100, count: counts['2-3'] },
      { label: '3 – 4 min', percent: (counts['3-4'] / total) * 100, count: counts['3-4'] },
      { label: '4 – 5 min', percent: (counts['4-5'] / total) * 100, count: counts['4-5'] },
      { label: '> 5 min', percent: (counts['>5'] / total) * 100, count: counts['>5'] },
    ]
    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    // Reorder so Monday is first
    const reorderedIndices = [1, 2, 3, 4, 5, 6, 0]
    
    dayOfWeekStats = reorderedIndices.map(i => ({
        day: daysArr[i],
        avg_time_seconds: dowCounts[i] > 0 ? dowSums[i] / dowCounts[i] : 0
    }))
  }

  return {
    summary: sum || null,
    weekly,
    monthly,
    topFastest: fastest || [],
    topSlowest: slowest || [],
    distribution,
    dayOfWeekStats,
    totalSeconds,
  }
}

export default function DashboardPage() {
  const [summary, setSummary] = useState<Summary | null>(() => cachedDashboardData?.summary ?? null)
  const [weekly, setWeekly] = useState<TimeBucket[]>(() => cachedDashboardData?.weekly ?? [])
  const [monthly, setMonthly] = useState<TimeBucket[]>(() => cachedDashboardData?.monthly ?? [])
  const [topFastest, setTopFastest] = useState<PuzzleTime[]>(() => cachedDashboardData?.topFastest ?? [])
  const [topSlowest, setTopSlowest] = useState<PuzzleTime[]>(() => cachedDashboardData?.topSlowest ?? [])
  const [distribution, setDistribution] = useState<DistributionBucket[]>(() => cachedDashboardData?.distribution ?? [])
  const [dayOfWeekStats, setDayOfWeekStats] = useState<DayOfWeekBucket[]>(() => cachedDashboardData?.dayOfWeekStats ?? [])
  const [totalSeconds, setTotalSeconds] = useState<number>(() => cachedDashboardData?.totalSeconds ?? 0)

  // Raw data needed to recalculate day of week stats on the fly when filtered
  const [allTimesData, setAllTimesData] = useState<{date: string, time_seconds: number}[]>([])

  // Filters: '1m', '3m', '6m', '1y', 'all'
  const [chartFilter, setChartFilter] = useState<string>('all')

  useEffect(() => {
    let isMounted = true

    if (cachedDashboardData) {
      return () => {
        isMounted = false
      }
    }

    if (!dashboardFetchPromise) {
      dashboardFetchPromise = fetchDashboardData()
        .then(data => {
          cachedDashboardData = data
          return data
        })
        .catch(error => {
          console.error('Failed to load dashboard data', error)
          throw error
        })
    }

    dashboardFetchPromise
      .then(data => {
        if (!isMounted) return
        setSummary(data.summary)
        setWeekly(data.weekly)
        setMonthly(data.monthly)
        setTopFastest(data.topFastest)
        setTopSlowest(data.topSlowest)
        setDistribution(data.distribution)
        setDayOfWeekStats(data.dayOfWeekStats)
        setTotalSeconds(data.totalSeconds)
        
        // Also fire off a quick supplemental query just to store all raw times for DOW recalculations
        supabase.from('puzzle_times').select('date, time_seconds').order('date', { ascending: true }).then((res) => {
            if (res.data) setAllTimesData(res.data)
        })
      })
      .catch(() => {
        // Errors are logged above; keep the existing state untouched.
      })
      .finally(() => {
        dashboardFetchPromise = null
      })

    return () => {
      isMounted = false
    }
  }, [])

  const fmt = (s: number) => {
    const m = Math.floor(s / 60)
      .toString()
      .padStart(2, '0')
    const sec = (s % 60).toString().padStart(2, '0')
    return `${m}:${sec}`
  }

  const formatDate = (d: string) => {
    const dt = new Date(d)
    if (Number.isNaN(dt.getTime())) return d
    return dt.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      timeZone: 'UTC',
    })
  }

  // Filter Logic
  const filterByDate = <T extends { period: string }>(dataArray: T[], filterStr: string): T[] => {
    if (filterStr === 'all') return dataArray
    const now = new Date()
    const cutoff = new Date(now)
    
    if (filterStr === '1m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 1)
    else if (filterStr === '3m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)
    else if (filterStr === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
    else if (filterStr === '1y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)
    
    return dataArray.filter(item => {
       const rowDate = new Date(item.period)
       return rowDate >= cutoff
    })
  }

  const filteredWeekly = filterByDate(weekly, chartFilter)
  const filteredMonthly = filterByDate(monthly, chartFilter)

  // Recalculate DOW based on raw data
  const filteredDayOfWeekStats = (() => {
    if (allTimesData.length === 0) return dayOfWeekStats // Fallback to initial if still loading raw
    if (chartFilter === 'all') return dayOfWeekStats

    const now = new Date()
    const cutoff = new Date(now)
    if (chartFilter === '1m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 1)
    else if (chartFilter === '3m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 3)
    else if (chartFilter === '6m') cutoff.setUTCMonth(cutoff.getUTCMonth() - 6)
    else if (chartFilter === '1y') cutoff.setUTCFullYear(cutoff.getUTCFullYear() - 1)

    const dowSums = [0, 0, 0, 0, 0, 0, 0]
    const dowCounts = [0, 0, 0, 0, 0, 0, 0]

    allTimesData.forEach(item => {
        const d = new Date(item.date)
        if (!isNaN(d.getTime()) && d >= cutoff) {
            const day = d.getUTCDay()
            dowSums[day] += item.time_seconds
            dowCounts[day]++
        }
    })

    const daysArr = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
    const reorderedIndices = [1, 2, 3, 4, 5, 6, 0]
    
    return reorderedIndices.map(i => ({
        day: daysArr[i],
        avg_time_seconds: dowCounts[i] > 0 ? dowSums[i] / dowCounts[i] : 0
    }))
  })()

  const timeFilters = [
    { value: '1m', label: '1M' },
    { value: '3m', label: '3M' },
    { value: '6m', label: '6M' },
    { value: '1y', label: '1Y' },
    { value: 'all', label: 'All' }
  ]

  return (
    <main className="relative mx-auto min-h-screen max-w-6xl space-y-10 px-5 py-16">
      <div className="space-y-2">
        <NavPill currentHref="/dashboard" />
        <h1 className="text-3xl font-extrabold text-white md:text-4xl">Puzzle performance</h1>
      </div>

      <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/60">Total Puzzles</h2>
          <p className="mt-3 text-4xl font-bold text-white">{summary?.total_puzzles ?? '–'}</p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/60">All-time Average</h2>
          <p className="mt-3 text-4xl font-bold text-white">
            {summary ? fmt(Math.round(summary.avg_time_seconds)) : '–'}
          </p>
        </div>
        <div className="rounded-3xl border border-white/10 bg-white/5 p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:col-span-2">
          <h2 className="text-sm uppercase tracking-[0.18em] text-white/60">Fastest Time</h2>
          {topFastest.length > 0 && (
            <p className="mt-3 text-4xl font-bold text-white">
              {fmt(topFastest[0].time_seconds)} on{' '}
              <span className="font-medium text-white/80">{formatDate(topFastest[0].date)}</span>
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 items-stretch md:grid-cols-2">
        <section className="overflow-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Time Distribution</h3>
          <table className="w-full table-fixed text-left text-sm text-white/80">
            <colgroup>
              <col className="w-1/3" />
              <col className="w-1/3" />
              <col className="w-1/3" />
            </colgroup>
            <thead className="rounded-lg bg-gradient-to-r from-sky-500/10 via-indigo-500/10 to-purple-500/10 text-white/80">
              <tr>
                <th className="pb-2">Range</th>
                <th className="pb-2">% of Runs</th>
                <th className="pb-2">Count</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-white/5 [&>tr>td]:py-2">
              {distribution.map((b, i) => (
                <tr key={i}>
                  <td>
                    <span className="inline-flex rounded-full bg-sky-500/15 px-3 py-1 text-sky-100">
                      {b.label}
                    </span>
                  </td>
                  <td className="font-semibold text-emerald-100">{b.percent.toFixed(2)}%</td>
                  <td className="text-indigo-100">{b.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Total Solve Time</h3>
          <table className="w-full table-fixed text-left text-sm text-white/80">
            <colgroup>
              <col className="w-1/2" />
              <col className="w-1/2" />
            </colgroup>
            <tbody className="[&>tr>td]:py-2">
              <tr>
                <td>Seconds</td>
                <td>
                  <span className="inline-flex rounded-lg bg-emerald-500/15 px-3 py-1 font-semibold text-emerald-100">
                    {totalSeconds}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Minutes</td>
                <td>
                  <span className="inline-flex rounded-lg bg-sky-500/15 px-3 py-1 font-semibold text-sky-100">
                    {(totalSeconds / 60).toFixed(2)}
                  </span>
                </td>
              </tr>
              <tr>
                <td>Hours</td>
                <td>
                  <span className="inline-flex rounded-lg bg-indigo-500/15 px-3 py-1 font-semibold text-indigo-100">
                    {(totalSeconds / 3600).toFixed(2)}
                  </span>
                </td>
              </tr>
            </tbody>
          </table>
        </section>

        <section className="overflow-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Top 10 Fastest Times</h3>
          <table className="w-full table-fixed text-left text-sm text-white/80">
            <colgroup>
              <col className="w-1/2" />
              <col className="w-1/2" />
            </colgroup>
            <thead className="rounded-lg bg-gradient-to-r from-emerald-500/10 via-sky-500/10 to-indigo-500/10 text-white/80">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-white/5 [&>tr>td]:py-2">
              {topFastest.map((item, i) => (
                <tr key={i}>
                  <td className="text-white/90">{formatDate(item.date)}</td>
                  <td className="font-semibold text-emerald-100">{fmt(item.time_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Top 10 Slowest Times</h3>
          <table className="w-full table-fixed text-left text-sm text-white/80">
            <colgroup>
              <col className="w-1/2" />
              <col className="w-1/2" />
            </colgroup>
            <thead className="rounded-lg bg-gradient-to-r from-amber-500/12 via-rose-500/12 to-indigo-500/12 text-white/80">
              <tr>
                <th className="pb-2">Date</th>
                <th className="pb-2">Time</th>
              </tr>
            </thead>
            <tbody className="[&>tr:nth-child(even)]:bg-white/5 [&>tr>td]:py-2">
              {topSlowest.map((item, i) => (
                <tr key={i}>
                  <td className="text-white/90">{formatDate(item.date)}</td>
                  <td className="font-semibold text-amber-100">{fmt(item.time_seconds)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>

        <section className="overflow-auto rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] backdrop-blur-2xl md:col-span-2">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-semibold">Average by Day of the Week</h3>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                {timeFilters.map(f => (
                    <button 
                       key={f.value}
                       onClick={() => setChartFilter(f.value)}
                       className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chartFilter === f.value ? 'bg-sky-500/80 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <BarChart data={filteredDayOfWeekStats} margin={{ top: 20, right: 30, left: 0, bottom: 5 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" vertical={false} />
                <XAxis dataKey="day" tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 13 }} axisLine={false} tickLine={false} />
                <YAxis tickFormatter={fmt} tick={{ fill: 'rgba(255,255,255,0.7)', fontSize: 13 }} axisLine={false} tickLine={false} />
                <Tooltip
                  cursor={{ fill: 'rgba(255,255,255,0.05)' }}
                  contentStyle={{ background: '#0c182e', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: 'white' }}
                  formatter={(value: unknown) => [fmt(Number(value)), 'Average Time']}
                />
                <Bar dataKey="avg_time_seconds" radius={[6, 6, 0, 0]} maxBarSize={60}>
                  {
                    filteredDayOfWeekStats.map((entry, index) => {
                      const colors = ['#38bdf8', '#818cf8', '#a78bfa', '#c084fc', '#e879f9', '#f472b6', '#fb7185']
                      return <Cell key={`cell-${index}`} fill={colors[index % colors.length]} />
                    })
                  }
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      <div className="grid grid-cols-1 gap-8">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-semibold">Weekly Average</h3>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                {timeFilters.map(f => (
                    <button 
                       key={f.value}
                       onClick={() => setChartFilter(f.value)}
                       className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chartFilter === f.value ? 'bg-sky-500/80 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={filteredWeekly} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="period"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                />
                <YAxis tickFormatter={fmt} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
                <Tooltip
                  contentStyle={{ background: '#0c182e', border: '1px solid rgba(255,255,255,0.1)' }}
                  labelStyle={{ color: 'white' }}
                  formatter={(value: unknown, name: string | undefined) => [fmt(Number(value)), name === 'avg_time_seconds' ? 'Weekly Avg' : name === 'moving_avg_30' ? '30-Day Trend' : '7-Day Trend']}
                />
                <Line
                  type="monotone"
                  dataKey="avg_time_seconds"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="moving_avg_30"
                  stroke="#F59E0B"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
            <h3 className="text-xl font-semibold">Monthly Average</h3>
            <div className="flex bg-white/5 rounded-lg p-1 border border-white/10">
                {timeFilters.map(f => (
                    <button 
                       key={f.value}
                       onClick={() => setChartFilter(f.value)}
                       className={`px-3 py-1 text-xs font-semibold rounded-md transition-colors ${chartFilter === f.value ? 'bg-sky-500/80 text-white shadow-sm' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                    >
                        {f.label}
                    </button>
                ))}
            </div>
          </div>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={filteredMonthly} margin={{ bottom: 60 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                <XAxis
                  dataKey="period"
                  angle={-45}
                  textAnchor="end"
                  height={60}
                  tick={{ fontSize: 12, fill: 'rgba(255,255,255,0.7)' }}
                />
                <YAxis tickFormatter={fmt} tick={{ fill: 'rgba(255,255,255,0.7)' }} />
                <Tooltip
                  contentStyle={{ background: '#0c182e', border: '1px solid rgba(255,255,255,0.1)' }}
                  labelStyle={{ color: 'white' }}
                  formatter={(value: unknown, name: string | undefined) => [fmt(Number(value)), name === 'avg_time_seconds' ? 'Monthly Avg' : '30-Day Trend']}
                />
                <Line
                  type="monotone"
                  dataKey="avg_time_seconds"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                  activeDot={{ r: 5 }}
                />
                <Line
                  type="monotone"
                  dataKey="moving_avg_30"
                  stroke="#8B5CF6"
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </main>
  )
}
