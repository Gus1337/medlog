import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis, type BarShapeProps } from 'recharts'
import type { DoseLog, EffectEntry, Feel, Medication, Tag } from '../../db/types'
import { afterDoseBins, type HourBin } from '../../lib/analytics'
import { FEEL_LABELS, useThemeColours } from '../../ui/colours'
import { Chip } from '../../ui/primitives'
import { ChartCard, LegendRow, NotEnough, TipBox, tableClass } from './ChartCard'

const STACK: Feel[] = ['good', 'neutral', 'bad'] // bottom to top

/** Rounds the top of whichever segment is highest in its stack. */
function stackSegment(feel: Feel, gap: string) {
  return function Segment(props: BarShapeProps) {
    const { x, y, width, height, payload } = props
    if (!height || height <= 0) return <g />
    const above = STACK.slice(STACK.indexOf(feel) + 1).some((f) => (payload as HourBin)[f] > 0)
    const r = above ? 0 : Math.min(4, width / 2, height)
    const d = `M${x},${y + height} V${y + r} Q${x},${y} ${x + r},${y} H${x + width - r} Q${x + width},${y} ${x + width},${y + r} V${y + height} Z`
    // A 2px surface-coloured stroke separates stacked segments.
    return <path d={d} fill={props.fill} stroke={gap} strokeWidth={above ? 2 : 0} paintOrder="stroke" />
  }
}

/** Effects by hours after a dose (0-12h), stacked by feel: onset, peak and wear-off. */
export function AfterDoseChart({
  medication,
  effects,
  doseLogs,
  tags,
}: {
  medication: Medication
  effects: EffectEntry[]
  doseLogs: DoseLog[]
  tags: Tag[]
}) {
  const c = useThemeColours()
  const [includeUnsure, setIncludeUnsure] = useState(false)
  const bins = useMemo(
    () => afterDoseBins(effects, doseLogs, medication.id, tags, { includeUnsure }),
    [effects, doseLogs, medication.id, tags, includeUnsure],
  )
  const total = bins.reduce((s, b) => s + b.total, 0)

  return (
    <ChartCard
      title={`After ${medication.name}`}
      description={`What you noticed in the 12 hours after a dose, by hour. ${total} ${total === 1 ? 'entry' : 'entries'}.`}
      controls={
        <Chip selected={includeUnsure} onClick={() => setIncludeUnsure(!includeUnsure)}>
          Include “not sure” entries
        </Chip>
      }
      legend={total > 0 && <LegendRow items={STACK.map((f) => ({ label: FEEL_LABELS[f], colour: c.feel[f] }))} />}
      table={
        total > 0 && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Hours</th>
                <th>Good</th>
                <th>Neutral</th>
                <th>Unwanted</th>
                <th>Common tags</th>
              </tr>
            </thead>
            <tbody>
              {bins.map((b) => (
                <tr key={b.hour}>
                  <td>{b.label}</td>
                  <td>{b.good}</td>
                  <td>{b.neutral}</td>
                  <td>{b.bad}</td>
                  <td>{b.topTags.join(', ')}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {total < 3 ? (
        <NotEnough>
          Log a few effects linked to {medication.name} after taking it, and this shows when they tend to start, peak and
          fade.
        </NotEnough>
      ) : (
        <ResponsiveContainer width="100%" height={210}>
          <BarChart data={bins} margin={{ top: 8, right: 4, left: -18, bottom: 0 }} barCategoryGap={3}>
            <CartesianGrid vertical={false} stroke={c.border} strokeDasharray="0" />
            <XAxis
              dataKey="hour"
              tickFormatter={(h: number) => `${h}h`}
              tick={{ fill: c.faint, fontSize: 12 }}
              axisLine={false}
              tickLine={false}
              interval={1}
            />
            <YAxis allowDecimals={false} tick={{ fill: c.faint, fontSize: 12 }} axisLine={false} tickLine={false} />
            <Tooltip
              cursor={{ fill: c.surface2, radius: 6 }}
              content={({ active, payload }) => {
                const b = active && (payload?.[0]?.payload as HourBin | undefined)
                if (!b) return null
                return (
                  <TipBox title={`${b.label} after dose`}>
                    {STACK.filter((f) => b[f] > 0).map((f) => (
                      <p key={f}>
                        {FEEL_LABELS[f]}: {b[f]}
                      </p>
                    ))}
                    {b.topTags.length > 0 && <p className="mt-1 text-muted">{b.topTags.join(', ')}</p>}
                  </TipBox>
                )
              }}
            />
            {STACK.map((f) => (
              <Bar key={f} dataKey={f} stackId="feel" fill={c.feel[f]} shape={stackSegment(f, c.surface)} isAnimationActive={false} />
            ))}
          </BarChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  )
}
