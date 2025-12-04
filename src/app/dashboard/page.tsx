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
} from 'recharts'
import NavPill from '@/components/NavPill'

interface Summary {
  total_puzzles: number
  avg_time_seconds: number
}

interface TimeBucket {
  period: string
  avg_time_seconds: number
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

interface DashboardData {
  summary: Summary | null
  weekly: TimeBucket[]
  monthly: TimeBucket[]
  topFastest: PuzzleTime[]
  topSlowest: PuzzleTime[]
  distribution: DistributionBucket[]
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

  const { data: allTimes } = await supabase
    .from('puzzle_times')
    .select('time_seconds')

  let totalSeconds = 0
  let distribution: DistributionBucket[] = []

  if (allTimes) {
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
  }

  return {
    summary: sum || null,
    weekly,
    monthly,
    topFastest: fastest || [],
    topSlowest: slowest || [],
    distribution,
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
  const [totalSeconds, setTotalSeconds] = useState<number>(() => cachedDashboardData?.totalSeconds ?? 0)

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
        setTotalSeconds(data.totalSeconds)
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
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-2">
        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Weekly Average</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={weekly} margin={{ bottom: 60 }}>
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
                  formatter={(value: number) => fmt(value)}
                />
                <Line
                  type="monotone"
                  dataKey="avg_time_seconds"
                  stroke="#10B981"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>

        <section className="rounded-3xl border border-white/10 bg-white/5 p-6 text-white shadow-[0_25px_80px_rgba(0,0,0,0.4)] backdrop-blur-2xl">
          <h3 className="mb-4 text-xl font-semibold">Monthly Average</h3>
          <div style={{ width: '100%', height: 300 }}>
            <ResponsiveContainer>
              <LineChart data={monthly} margin={{ bottom: 60 }}>
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
                  formatter={(value: number) => fmt(value)}
                />
                <Line
                  type="monotone"
                  dataKey="avg_time_seconds"
                  stroke="#3B82F6"
                  strokeWidth={2}
                  dot={{ r: 3 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
    </main>
  )
}
