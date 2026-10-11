import { useMemo } from 'react'
import { Bar, BarChart, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { EffectEntry, Medication, Tag } from '../../db/types'
import { tagBreakdown, type TagCount } from '../../lib/analytics'
import { useThemeColours } from '../../ui/colours'
import { ChartCard, NotEnough, TipBox, tableClass } from './ChartCard'

/** Most common tags for one medication, split into wanted and unwanted effects. */
export function EffectBreakdown({ medication, effects, tags }: { medication: Medication; effects: EffectEntry[]; tags: Tag[] }) {
  const c = useThemeColours()
  const data = useMemo(() => tagBreakdown(effects, medication.id, tags), [effects, medication.id, tags])
  const empty = data.good.length === 0 && data.bad.length === 0
  const max = Math.max(1, ...data.good.map((d) => d.count), ...data.bad.map((d) => d.count))

  const group = (title: string, rows: TagCount[], colour: string, emptyText: string) => (
    <div>
      <p className="mb-1 flex items-center gap-1.5 text-[15px] font-medium">
        <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: colour }} />
        {title}
      </p>
      {rows.length === 0 ? (
        <p className="pb-2 text-[15px] text-faint">{emptyText}</p>
      ) : (
        <ResponsiveContainer width="100%" height={rows.length * 34 + 4}>
          <BarChart data={rows} layout="vertical" margin={{ top: 0, right: 32, left: 0, bottom: 0 }} barCategoryGap={6}>
            <XAxis type="number" hide domain={[0, max]} />
            <YAxis
              type="category"
              dataKey="tag"
              width={118}
              tick={{ fill: c.text, fontSize: 14 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(t: string) => (t.length > 16 ? `${t.slice(0, 15)}…` : t)}
            />
            <Tooltip
              cursor={{ fill: c.surface2, radius: 6 }}
              content={({ active, payload }) => {
                const r = active && (payload?.[0]?.payload as TagCount | undefined)
                return r ? <TipBox title={r.tag}>{r.count} {r.count === 1 ? 'time' : 'times'}</TipBox> : null
              }}
            />
            <Bar dataKey="count" fill={colour} radius={[0, 4, 4, 0]} isAnimationActive={false}>
              <LabelList dataKey="count" position="right" fill={c.muted} fontSize={13} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </div>
  )

  return (
    <ChartCard
      title={`Effects of ${medication.name}`}
      description="The tags you used most on entries linked to this medication."
      table={
        !empty && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Tag</th>
                <th>Kind</th>
                <th>Times</th>
              </tr>
            </thead>
            <tbody>
              {[...data.good.map((r) => ({ ...r, kind: 'wanted' })), ...data.bad.map((r) => ({ ...r, kind: 'unwanted' }))].map((r) => (
                <tr key={`${r.kind}-${r.tag}`}>
                  <td>{r.tag}</td>
                  <td>{r.kind}</td>
                  <td>{r.count}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      {empty ? (
        <NotEnough>Tag the effects you link to {medication.name} and the most common ones will be listed here, wanted and unwanted.</NotEnough>
      ) : (
        <div className="space-y-4">
          {group('Wanted', data.good, c.feel.good, 'No good effects logged yet.')}
          {group('Unwanted', data.bad, c.feel.bad, 'No unwanted effects logged.')}
          {data.neutral > 0 && (
            <p className="text-[13px] text-muted">
              Plus {data.neutral} neutral {data.neutral === 1 ? 'entry' : 'entries'}.
            </p>
          )}
        </div>
      )}
    </ChartCard>
  )
}
