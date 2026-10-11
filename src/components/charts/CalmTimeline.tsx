import { useMemo } from 'react'
import {
  CartesianGrid,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { CheckIn, DoseChange, DoseLog, Medication } from '../../db/types'
import { rollingMean } from '../../lib/analytics'
import { dayKeyToTs, formatShortDate, HOUR } from '../../lib/time'
import { useThemeColours } from '../../ui/colours'
import { ChartCard, LegendRow, NotEnough, TipBox, tableClass } from './ChartCard'

const METRICS = [
  { key: 'focus', label: 'Focus', hint: 'higher is sharper' },
  { key: 'anxiety', label: 'Anxiety', hint: 'lower is calmer' },
  { key: 'mood', label: 'Mood', hint: 'higher is brighter' },
  { key: 'sleep', label: 'Sleep', hint: 'higher is better rested' },
] as const

type MetricKey = (typeof METRICS)[number]['key']

interface Row {
  ts: number
  raw: number
  smooth: number
}

/**
 * Check-ins over weeks as four small charts sharing one time axis (one metric
 * each, so colour never has to tell lines apart), with dose changes as
 * vertical lines and skipped doses in a strip underneath.
 */
export function CalmTimeline({
  from,
  to,
  checkIns,
  doseChanges,
  doseLogs,
  medications,
}: {
  from: number
  to: number
  checkIns: CheckIn[]
  doseChanges: DoseChange[]
  doseLogs: DoseLog[]
  medications: Medication[]
}) {
  const c = useThemeColours()
  // Check-ins are about the evening; place them at 20:00 on their day.
  const points = useMemo(() => checkIns.map((ci) => ({ ts: dayKeyToTs(ci.date) + 20 * HOUR, ci })).sort((a, b) => a.ts - b.ts), [checkIns])
  const series = useMemo(() => {
    const out = {} as Record<MetricKey, Row[]>
    for (const m of METRICS) {
      const raw = points.map((p) => ({ ts: p.ts, value: p.ci[m.key] }))
      const smooth = rollingMean(raw, 7)
      out[m.key] = raw.map((r, i) => ({ ts: r.ts, raw: r.value, smooth: Math.round(smooth[i].value * 100) / 100 }))
    }
    return out
  }, [points])

  const medName = (id: string) => medications.find((m) => m.id === id)?.name ?? 'Medication'
  // The first DoseChange per medication is its starting dose, not a change.
  const changes = useMemo(() => {
    const firsts = new Set<string>()
    return [...doseChanges]
      .sort((a, b) => a.date - b.date)
      .filter((dc) => {
        if (!firsts.has(dc.medicationId)) {
          firsts.add(dc.medicationId)
          return false
        }
        return dc.date >= from && dc.date < to
      })
  }, [doseChanges, from, to])
  const skipped = doseLogs.filter((l) => l.status === 'skipped' && l.timestamp >= from && l.timestamp < to)
  const medsWithSkips = medications.filter((m) => skipped.some((s) => s.medicationId === m.id))

  const domain = [from, to] as [number, number]
  const xTicks = useMemo(() => {
    const ticks: number[] = []
    const step = Math.max(7, Math.round((to - from) / (24 * HOUR) / 5)) * 24 * HOUR
    for (let t = to - step / 2; t > from; t -= step) ticks.unshift(t)
    return ticks
  }, [from, to])

  return (
    <ChartCard
      title="Calm timeline"
      description="Your evening check-ins, smoothed over a week. Vertical lines mark dose changes."
      legend={
        points.length >= 3 && (
          <LegendRow
            items={[
              { label: '7-day average', colour: c.accent, shape: 'line' },
              { label: 'Each check-in', colour: c.faint },
              { label: 'Dose change', colour: c.muted, shape: 'line' },
            ]}
          />
        )
      }
      table={
        points.length > 0 && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Day</th>
                {METRICS.map((m) => (
                  <th key={m.key}>{m.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.ci.id}>
                  <td>{formatShortDate(p.ts)}</td>
                  {METRICS.map((m) => (
                    <td key={m.key}>{p.ci[m.key]}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {points.length < 3 ? (
        <NotEnough>A few evening check-ins will draw calm lines here, so you can see slow changes over weeks.</NotEnough>
      ) : (
        <div className="space-y-1">
          {METRICS.map((m, i) => (
            <div key={m.key}>
              <p className="text-[13px] text-muted">
                <span className="font-medium text-ink">{m.label}</span> · {m.hint}
              </p>
              <ResponsiveContainer width="100%" height={i === METRICS.length - 1 && medsWithSkips.length === 0 ? 92 : 72}>
                <ComposedChart data={series[m.key]} margin={{ top: 6, right: 6, left: -26, bottom: 0 }}>
                  <CartesianGrid vertical={false} stroke={c.border} />
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={domain}
                    ticks={xTicks}
                    tickFormatter={formatShortDate}
                    tick={{ fill: c.faint, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                    hide={i < METRICS.length - 1 || medsWithSkips.length > 0}
                  />
                  <YAxis domain={[1, 5]} ticks={[1, 3, 5]} tick={{ fill: c.faint, fontSize: 11 }} axisLine={false} tickLine={false} />
                  {changes.map((dc) => (
                    <ReferenceLine key={dc.id} x={dc.date} stroke={c.muted} strokeDasharray="3 3" />
                  ))}
                  <Tooltip
                    cursor={{ stroke: c.border }}
                    content={({ active, payload }) => {
                      const r = active && (payload?.[0]?.payload as Row | undefined)
                      if (!r) return null
                      return (
                        <TipBox title={formatShortDate(r.ts)}>
                          <p>
                            {m.label}: {r.raw}
                          </p>
                          <p className="text-muted">7-day average {r.smooth.toFixed(1)}</p>
                        </TipBox>
                      )
                    }}
                  />
                  <Scatter dataKey="raw" fill={c.faint} shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={2.5} fill={c.faint} />} isAnimationActive={false} />
                  <Line dataKey="smooth" stroke={c.accent} strokeWidth={2} dot={false} type="monotone" isAnimationActive={false} activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          ))}
          {medsWithSkips.length > 0 && (
            <div>
              <p className="text-[13px] text-muted">
                <span className="font-medium text-ink">Skipped doses</span>
              </p>
              <ResponsiveContainer width="100%" height={36 + medsWithSkips.length * 22}>
                <ScatterChart margin={{ top: 6, right: 6, left: 0, bottom: 0 }}>
                  <XAxis
                    dataKey="ts"
                    type="number"
                    scale="time"
                    domain={domain}
                    ticks={xTicks}
                    tickFormatter={formatShortDate}
                    tick={{ fill: c.faint, fontSize: 12 }}
                    axisLine={false}
                    tickLine={false}
                  />
                  <YAxis
                    dataKey="row"
                    type="number"
                    domain={[-0.5, medsWithSkips.length - 0.5]}
                    ticks={medsWithSkips.map((_, i) => i)}
                    tickFormatter={(i: number) => truncate(medsWithSkips[i]?.name ?? '', 10)}
                    tick={{ fill: c.muted, fontSize: 11 }}
                    axisLine={false}
                    tickLine={false}
                    width={70}
                    reversed
                  />
                  {changes.map((dc) => (
                    <ReferenceLine key={dc.id} x={dc.date} stroke={c.muted} strokeDasharray="3 3" />
                  ))}
                  <Tooltip
                    cursor={false}
                    content={({ active, payload }) => {
                      const s = active && (payload?.[0]?.payload as { ts: number; medicationId: string } | undefined)
                      if (!s) return null
                      return <TipBox title={formatShortDate(s.ts)}>{medName(s.medicationId)} skipped</TipBox>
                    }}
                  />
                  {medsWithSkips.map((m, row) => (
                    <Scatter
                      key={m.id}
                      data={skipped.filter((s) => s.medicationId === m.id).map((s) => ({ ts: s.timestamp, row, medicationId: m.id }))}
                      fill={c.med[m.colour]}
                      shape={(p: { cx?: number; cy?: number }) => <circle cx={p.cx} cy={p.cy} r={4.5} fill={c.med[m.colour]} stroke={c.surface} strokeWidth={2} />}
                      isAnimationActive={false}
                    />
                  ))}
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          )}
          {changes.length > 0 && (
            <ul className="pt-2 text-[13px] text-muted">
              {changes.map((dc) => (
                <li key={dc.id}>
                  {formatShortDate(dc.date)}: {medName(dc.medicationId)} changed to {dc.amount} {dc.unit}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </ChartCard>
  )
}

const truncate = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)
