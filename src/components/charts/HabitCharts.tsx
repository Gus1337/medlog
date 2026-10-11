import { useMemo, useState } from 'react'
import { CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { Habit, HabitLog } from '../../db/types'
import { amountSeries, formatAmount, habitStart, progressSeries } from '../../lib/habits'
import { addDays, DAY, formatShortDate, startOfDay } from '../../lib/time'
import { useThemeColours } from '../../ui/colours'
import { Chip } from '../../ui/primitives'
import { ChartCard, LegendRow, NotEnough, TipBox, tableClass } from './ChartCard'

export type HabitPeriod = '4w' | '3m' | '1y'
export const HABIT_PERIODS: { value: HabitPeriod; label: string; days: number }[] = [
  { value: '4w', label: '4 weeks', days: 28 },
  { value: '3m', label: '3 months', days: 91 },
  { value: '1y', label: 'Year', days: 364 },
]

/** Range for a period, ending with today. */
export function periodRange(period: HabitPeriod, now: number) {
  const days = HABIT_PERIODS.find((p) => p.value === period)!.days
  const to = addDays(startOfDay(now), 1)
  return { from: addDays(to, -days), to }
}

/** Starts the chart when the earliest habit started, so a new habit doesn't sit at the far right of a long period. */
function clampStart(from: number, habits: Habit[], logs: HabitLog[], to: number) {
  const start = Math.min(...habits.map((h) => habitStart(h, logs)))
  // Keep at least two weeks on screen.
  return Math.max(from, Math.min(start, addDays(to, -14)))
}

/** Evenly spaced date ticks, ending near the right edge. */
function dateTicks(from: number, to: number): number[] {
  const days = Math.round((to - from) / DAY)
  const step = Math.max(7, Math.round(days / 4 / 7) * 7) * DAY
  const ticks: number[] = []
  for (let t = to - DAY; t >= from; t -= step) ticks.unshift(t)
  return ticks
}

function useAxes(from: number, to: number) {
  const c = useThemeColours()
  const ticks = useMemo(() => dateTicks(from, to), [from, to])
  return {
    c,
    xAxis: (
      <XAxis
        dataKey="ts"
        type="number"
        scale="time"
        domain={[from, to - DAY]}
        ticks={ticks}
        tickFormatter={formatShortDate}
        tick={{ fill: c.faint, fontSize: 12 }}
        axisLine={false}
        tickLine={false}
      />
    ),
    grid: <CartesianGrid vertical={false} stroke={c.border} />,
  }
}

/**
 * Progress of several habits on one line chart: for each day, how much of the
 * weekly target was reached over the last 7 days (100% = on target).
 */
export function HabitProgressChart({
  habits,
  logs,
  from,
  to,
  now,
}: {
  habits: Habit[]
  logs: HabitLog[]
  from: number
  to: number
  now: number
}) {
  from = clampStart(from, habits, logs, to)
  const { c, xAxis, grid } = useAxes(from, to)
  const [hidden, setHidden] = useState<Set<string>>(new Set())
  const shown = habits.filter((h) => !hidden.has(h.id))

  const { rows, hasData } = useMemo(() => {
    const series = habits.map((h) => ({ h, points: progressSeries(h, logs, from, to, now) }))
    const rows = series[0]?.points.map((p, i) => {
      const row: Record<string, number | null> = { ts: p.ts }
      for (const s of series) {
        row[s.h.id] = s.points[i].pct
        row[`${s.h.id}:days`] = s.points[i].days
      }
      return row
    }) ?? []
    // A line needs at least two days to draw.
    const hasData = series.some((s) => s.points.filter((p) => p.pct !== null).length >= 2)
    return { rows, hasData }
  }, [habits, logs, from, to, now])

  const toggle = (id: string) => {
    const next = new Set(hidden)
    if (next.has(id)) next.delete(id)
    else if (shown.length > 1) next.add(id)
    setHidden(next)
  }

  // One row per week for the table, ending today.
  const weekly = rows.filter((r) => (r.ts as number) <= now && Math.round((Math.min(now, to - DAY) - (r.ts as number)) / DAY) % 7 === 0).reverse()

  return (
    <ChartCard
      title="Progress"
      description="How much of each weekly target you reached over the 7 days up to each day. The dashed line is your target."
      controls={
        habits.length > 1 && (
          <div className="flex flex-wrap gap-2">
            {habits.map((h) => (
              <Chip key={h.id} selected={!hidden.has(h.id)} colour={c.habit[h.colour]} onClick={() => toggle(h.id)}>
                {h.name}
              </Chip>
            ))}
          </div>
        )
      }
      legend={
        hasData && (
          <LegendRow
            items={[
              ...shown.map((h) => ({ label: h.name, colour: c.habit[h.colour], shape: 'line' as const })),
              { label: 'Weekly target', colour: c.muted, shape: 'dash' as const },
            ]}
          />
        )
      }
      table={
        hasData && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Week to</th>
                {shown.map((h) => (
                  <th key={h.id}>{h.name}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {weekly.map((r) => (
                <tr key={r.ts}>
                  <td>{formatShortDate(r.ts as number)}</td>
                  {shown.map((h) => (
                    <td key={h.id}>{r[`${h.id}:days`] === null ? '–' : `${r[`${h.id}:days`]} of ${h.weeklyTarget} days`}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {!hasData ? (
        <NotEnough>After a couple of days of logging, a line for each habit will show how close you are to your weekly target.</NotEnough>
      ) : (
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={rows} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
            {grid}
            {xAxis}
            <YAxis
              domain={[0, 100]}
              ticks={[0, 50, 100]}
              tickFormatter={(v: number) => `${v}%`}
              tick={{ fill: c.faint, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
            />
            <ReferenceLine y={100} stroke={c.muted} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: c.border }}
              content={({ active, payload }) => {
                const r = active && (payload?.[0]?.payload as Record<string, number | null> | undefined)
                if (!r) return null
                return (
                  <TipBox title={`7 days to ${formatShortDate(r.ts as number)}`}>
                    {shown.map((h) =>
                      r[h.id] === null ? null : (
                        <p key={h.id} className="flex items-center gap-1.5">
                          <span className="h-0.5 w-3 rounded-full" style={{ backgroundColor: c.habit[h.colour] }} />
                          {h.name}: {r[`${h.id}:days`]} of {h.weeklyTarget} days
                        </p>
                      ),
                    )}
                  </TipBox>
                )
              }}
            />
            {shown.map((h) => (
              <Line
                key={h.id}
                dataKey={h.id}
                name={h.name}
                stroke={c.habit[h.colour]}
                strokeWidth={2}
                type="monotone"
                dot={false}
                activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
                isAnimationActive={false}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

/** One habit's days on target in each rolling week, against its weekly target. */
export function HabitDaysChart({ habit, logs, from, to, now }: { habit: Habit; logs: HabitLog[]; from: number; to: number; now: number }) {
  from = clampStart(from, [habit], logs, to)
  const { c, xAxis, grid } = useAxes(from, to)
  const colour = c.habit[habit.colour]
  const points = useMemo(() => progressSeries(habit, logs, from, to, now), [habit, logs, from, to, now])
  const hasData = points.filter((p) => p.days !== null).length >= 2
  const weekly = points.filter((p) => p.days !== null && Math.round((Math.min(now, to - DAY) - p.ts) / DAY) % 7 === 0).reverse()

  return (
    <ChartCard
      title="Days on target"
      description={`Out of the 7 days up to each day. Your target is ${habit.weeklyTarget} ${habit.weeklyTarget === 1 ? 'day' : 'days'} a week (dashed line).`}
      table={
        hasData && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Week to</th>
                <th>Days on target</th>
              </tr>
            </thead>
            <tbody>
              {weekly.map((p) => (
                <tr key={p.ts}>
                  <td>{formatShortDate(p.ts)}</td>
                  <td>
                    {p.days} of {habit.weeklyTarget}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {!hasData ? (
        <NotEnough>Log this habit for a couple of days and a line will show how many days a week you reach your target.</NotEnough>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: -24, bottom: 0 }}>
            {grid}
            {xAxis}
            <YAxis domain={[0, 7]} ticks={[...new Set([0, habit.weeklyTarget, 7])]} tick={{ fill: c.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
            <ReferenceLine y={habit.weeklyTarget} stroke={c.muted} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: c.border }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as (typeof points)[number] | undefined)
                if (!p || p.days === null) return null
                return (
                  <TipBox title={`7 days to ${formatShortDate(p.ts)}`}>
                    {p.days} of {habit.weeklyTarget} days on target
                  </TipBox>
                )
              }}
            />
            <Line
              dataKey="days"
              stroke={colour}
              strokeWidth={2}
              type="stepAfter"
              dot={false}
              activeDot={{ r: 4, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}

/** Logged amounts per day for an amount habit, against the daily target. */
export function HabitAmountChart({ habit, logs, from, to }: { habit: Habit; logs: HabitLog[]; from: number; to: number }) {
  from = clampStart(from, [habit], logs, to)
  const { c, xAxis, grid } = useAxes(from, to)
  const colour = c.habit[habit.colour]
  const points = useMemo(() => amountSeries(habit, logs, from, to), [habit, logs, from, to])
  const max = Math.max(habit.dailyTarget, ...points.map((p) => p.value))
  const showDots = points.length <= 60

  return (
    <ChartCard
      title={habit.unit ? `Daily ${habit.unit}` : 'Daily amount'}
      description={`Each logged day. The dashed line is your daily target of ${formatAmount(habit, habit.dailyTarget)}.`}
      table={
        points.length > 0 && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Amount</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.ts}>
                  <td>{formatShortDate(p.ts)}</td>
                  <td>{formatAmount(habit, p.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {points.length < 2 ? (
        <NotEnough>Log an amount on a couple of days and they’ll be drawn here against your daily target.</NotEnough>
      ) : (
        <ResponsiveContainer width="100%" height={200}>
          <LineChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
            {grid}
            {xAxis}
            <YAxis
              domain={[0, Math.ceil(max * 1.1)]}
              tickFormatter={(v: number) => (v >= 10000 ? `${Math.round(v / 1000)}k` : v.toLocaleString())}
              tick={{ fill: c.faint, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              width={44}
            />
            <ReferenceLine y={habit.dailyTarget} stroke={c.muted} strokeDasharray="4 4" />
            <Tooltip
              cursor={{ stroke: c.border }}
              content={({ active, payload }) => {
                const p = active && (payload?.[0]?.payload as (typeof points)[number] | undefined)
                if (!p) return null
                return <TipBox title={formatShortDate(p.ts)}>{formatAmount(habit, p.value)}</TipBox>
              }}
            />
            <Line
              dataKey="value"
              stroke={colour}
              strokeWidth={2}
              type="monotone"
              dot={showDots ? { r: 4, fill: colour, stroke: c.surface, strokeWidth: 2 } : false}
              activeDot={{ r: 5, stroke: c.surface, strokeWidth: 2 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
