'use client'

import { fmtTime } from '@/lib/format'

/* Pure-SVG charts. Every paint goes through the theme tokens via the `style`
   prop (SVG presentation *attributes* cannot resolve var()), so light/dark
   switching is handled entirely by CSS. */

export type Bucket = { label: string; count: number; percent?: number }
export type MonthPoint = { month: string; avg: number }
export type DowStat = { day: string; avg: number }

/** Solve-time distribution — "How a normal morning goes". */
export function HistBar({ buckets, height = 180 }: { buckets: Bucket[]; height?: number }) {
  const max = Math.max(0, ...buckets.map(b => b.count))
  return (
    <div style={{ width: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 8, height }}>
        {buckets.map((b, i) => {
          const h = max ? (b.count / max) * (height - 28) : 0
          return (
            <div
              key={b.label}
              style={{
                flex: 1,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 4,
              }}
            >
              <div className="tnum mono" style={{ fontSize: 11, color: 'var(--muted)' }}>
                {b.count}
              </div>
              <div
                style={{
                  width: '100%',
                  height: h,
                  background: 'var(--accent)',
                  borderRadius: '4px 4px 0 0',
                  transition: 'height .8s cubic-bezier(.2,.7,.1,1)',
                  opacity: 0.55 + (i / Math.max(1, buckets.length)) * 0.45,
                }}
              />
            </div>
          )
        })}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
        {buckets.map(b => (
          <div
            key={b.label}
            style={{
              flex: 1,
              textAlign: 'center',
              fontSize: 10,
              color: 'var(--muted)',
              fontFamily: 'var(--mono)',
            }}
          >
            <div>{b.label}</div>
            {b.percent != null && (
              <div style={{ opacity: 0.7, marginTop: 2 }}>{b.percent.toFixed(0)}%</div>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

/** Average solve time over time, with an optional dashed rolling average. */
export function LineChart({
  data,
  height = 200,
  secondary,
}: {
  data: MonthPoint[]
  height?: number
  /** Parallel series (same length) drawn as a dashed trend line. */
  secondary?: (number | null)[]
}) {
  if (!data || data.length === 0) return <Empty height={height} />

  const W = 800
  const H = height
  const P = 28
  const vals = [
    ...data.map(d => d.avg),
    ...(secondary ?? []).filter((v): v is number => v != null),
  ]
  const minV = Math.min(...vals)
  const maxV = Math.max(...vals)
  const xs = (i: number) => P + (i / Math.max(1, data.length - 1)) * (W - 2 * P)
  const ys = (v: number) => H - P - ((v - minV) / (maxV - minV || 1)) * (H - 2 * P)

  const linePath = data.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.avg).toFixed(1)}`).join(' ')
  const areaPath = `${linePath} L${xs(data.length - 1).toFixed(1)},${H - P} L${P},${H - P} Z`

  const secondaryPath = secondary
    ? secondary
        .map((v, i) => (v == null ? null : `L${xs(i).toFixed(1)},${ys(v).toFixed(1)}`))
        .filter(Boolean)
        .join(' ')
        .replace(/^L/, 'M')
    : null

  const tickVals = [minV, (minV + maxV) / 2, maxV]
  const step = Math.max(1, Math.floor(data.length / 6))

  return (
    <div style={{ width: '100%', overflow: 'hidden' }}>
      <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
        {tickVals.map((v, i) => (
          <g key={i}>
            <line
              x1={P}
              x2={W - P}
              y1={ys(v)}
              y2={ys(v)}
              strokeDasharray="2 4"
              style={{ stroke: 'var(--muted)', strokeOpacity: 0.25 }}
            />
            <text
              x={P - 6}
              y={ys(v) + 4}
              textAnchor="end"
              fontSize="10"
              fontFamily="var(--mono)"
              style={{ fill: 'var(--muted)' }}
            >
              {fmtTime(Math.round(v))}
            </text>
          </g>
        ))}
        <path d={areaPath} style={{ fill: 'var(--accent)', fillOpacity: 0.14 }} />
        <path
          d={linePath}
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          style={{ fill: 'none', stroke: 'var(--accent)' }}
        />
        {secondaryPath && (
          <path
            d={secondaryPath}
            strokeWidth="1.5"
            strokeDasharray="4 4"
            strokeLinejoin="round"
            strokeLinecap="round"
            style={{ fill: 'none', stroke: 'var(--ink)', strokeOpacity: 0.7 }}
          />
        )}
        {data.map((d, i) =>
          i % step === 0 ? (
            <text
              key={d.month}
              x={xs(i)}
              y={H - 8}
              textAnchor="middle"
              fontSize="9"
              fontFamily="var(--mono)"
              style={{ fill: 'var(--muted)' }}
            >
              {d.month.slice(2)}
            </text>
          ) : null
        )}
      </svg>
    </div>
  )
}

/** Running minimum — the record falling over time. */
export function BestProgression({
  days,
  height = 160,
}: {
  days: { date: string; seconds: number | null }[]
  height?: number
}) {
  const solved = days.filter(d => d.seconds != null)
  if (solved.length === 0) return <Empty height={height} />

  const monthBest = new Map<string, number>()
  let running = Infinity
  solved.forEach(d => {
    running = Math.min(running, d.seconds as number)
    const m = d.date.slice(0, 7)
    const cur = monthBest.get(m)
    if (cur === undefined || running < cur) monthBest.set(m, running)
  })

  const arr = [...monthBest.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([month, val]) => ({ month, val }))
  if (arr.length < 2) return <Empty height={height} />

  const W = 800
  const H = height
  const P = 22
  const maxV = arr[0].val
  const minV = arr[arr.length - 1].val
  const xs = (i: number) => P + (i / Math.max(1, arr.length - 1)) * (W - 2 * P)
  const ys = (v: number) => H - P - ((maxV - v) / (maxV - minV || 1)) * (H - 2 * P)

  const path = arr.map((d, i) => `${i === 0 ? 'M' : 'L'}${xs(i).toFixed(1)},${ys(d.val).toFixed(1)}`).join(' ')
  const area = `${path} L${xs(arr.length - 1).toFixed(1)},${H - P} L${P},${H - P} Z`
  const last = arr[arr.length - 1]

  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height, display: 'block' }}>
      <path d={area} style={{ fill: 'var(--accent)', fillOpacity: 0.14 }} />
      <path
        d={path}
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        style={{ fill: 'none', stroke: 'var(--accent)' }}
      />
      <circle cx={xs(arr.length - 1)} cy={ys(last.val)} r="4" style={{ fill: 'var(--accent)' }} />
      <text
        x={xs(arr.length - 1) - 8}
        y={ys(last.val) - 8}
        textAnchor="end"
        fontSize="11"
        fontWeight="600"
        fontFamily="var(--mono)"
        style={{ fill: 'var(--ink)' }}
      >
        {fmtTime(last.val)}
      </text>
      <text
        x={xs(0)}
        y={ys(arr[0].val) - 8}
        textAnchor="start"
        fontSize="10"
        fontFamily="var(--mono)"
        style={{ fill: 'var(--muted)' }}
      >
        {fmtTime(arr[0].val)}
      </text>
    </svg>
  )
}

/** Day-of-week averages as a radial wedge chart. */
export function RadialDow({ stats, size = 260 }: { stats: DowStat[]; size?: number }) {
  const withData = stats.filter(s => s.avg > 0)
  if (withData.length === 0) return <Empty height={size} />

  const cx = size / 2
  const cy = size / 2
  const rOuter = size / 2 - 24
  const rInner = 40
  const max = Math.max(...stats.map(s => s.avg))
  const days = stats.length
  const overall = withData.reduce((s, x) => s + x.avg, 0) / withData.length

  const point = (ang: number, rr: number): [number, number] => [
    cx + Math.cos(ang) * rr,
    cy + Math.sin(ang) * rr,
  ]

  return (
    <svg
      viewBox={`0 0 ${size} ${size}`}
      // Capped so the wedges do not balloon to the full card width.
      style={{ width: '100%', maxWidth: size + 60, height: 'auto', display: 'block', margin: '0 auto' }}
    >
      <circle cx={cx} cy={cy} r={rOuter} style={{ fill: 'none', stroke: 'var(--muted)', strokeOpacity: 0.25 }} />
      <circle cx={cx} cy={cy} r={rInner} style={{ fill: 'none', stroke: 'var(--muted)', strokeOpacity: 0.25 }} />
      {stats.map((s, i) => {
        const a0 = (i / days) * Math.PI * 2 - Math.PI / 2 + 0.04
        const a1 = ((i + 1) / days) * Math.PI * 2 - Math.PI / 2 - 0.04
        const r = rInner + (rOuter - rInner) * (max ? s.avg / max : 0)
        const [x1, y1] = point(a0, rInner)
        const [x2, y2] = point(a1, rInner)
        const [x3, y3] = point(a1, r)
        const [x4, y4] = point(a0, r)
        const large = a1 - a0 > Math.PI ? 1 : 0
        const d = `M${x1},${y1} A${rInner},${rInner} 0 ${large} 1 ${x2},${y2} L${x3},${y3} A${r},${r} 0 ${large} 0 ${x4},${y4} Z`
        const [lx, ly] = point((a0 + a1) / 2, rOuter + 12)
        return (
          <g key={s.day}>
            <path d={d} style={{ fill: 'var(--accent)', opacity: 0.45 + 0.55 * (max ? s.avg / max : 0) }} />
            <text
              x={lx}
              y={ly}
              dy="4"
              textAnchor="middle"
              fontSize="11"
              fontWeight="600"
              fontFamily="var(--sans)"
              style={{ fill: 'var(--ink)' }}
            >
              {s.day}
            </text>
          </g>
        )
      })}
      <text
        x={cx}
        y={cy - 4}
        textAnchor="middle"
        fontSize="10"
        fontFamily="var(--mono)"
        letterSpacing=".1em"
        style={{ fill: 'var(--muted)' }}
      >
        AVG
      </text>
      <text
        x={cx}
        y={cy + 14}
        textAnchor="middle"
        fontSize="13"
        fontWeight="600"
        fontFamily="var(--mono)"
        style={{ fill: 'var(--ink)' }}
      >
        {fmtTime(Math.round(overall))}
      </text>
    </svg>
  )
}

function Empty({ height }: { height: number }) {
  return (
    <div
      style={{
        height,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--mono)',
        fontSize: 11,
        letterSpacing: '.18em',
        textTransform: 'uppercase',
        color: 'var(--muted)',
      }}
    >
      Not enough data yet
    </div>
  )
}
