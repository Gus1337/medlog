import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { db } from '../../db/db'
import { monthCells, type DayCell } from '../../lib/analytics'
import { dayKey } from '../../lib/time'
import { IconButton } from '../../ui/primitives'
import { ChartCard, tableClass } from './ChartCard'

/** Tile colour: harder days lean towards the unwanted colour, better days towards good. */
export function scoreColour(score: number | undefined): string {
  if (score === undefined) return 'var(--surface-2)'
  const strength = Math.round(25 + Math.min(1, Math.abs(score)) * 65)
  if (Math.abs(score) < 0.1) return 'color-mix(in oklab, var(--neutral) 55%, var(--surface))'
  const hue = score > 0 ? 'var(--good)' : 'var(--bad)'
  return `color-mix(in oklab, ${hue} ${strength}%, var(--surface))`
}

function describe(score: number | undefined) {
  if (score === undefined) return 'no entries'
  if (score > 0.5) return 'felt good'
  if (score > 0.1) return 'leaned good'
  if (score >= -0.1) return 'mixed or neutral'
  if (score >= -0.5) return 'leaned harder'
  return 'felt hard'
}

const WEEKDAYS = ['M', 'T', 'W', 'T', 'F', 'S', 'S']

/** One rounded tile per day of a month, shaded by how the day felt. */
export function MonthMosaic() {
  const [month, setMonth] = useState(() => {
    const d = new Date()
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime()
  })
  const [selected, setSelected] = useState<DayCell | null>(null)
  const next = new Date(new Date(month).getFullYear(), new Date(month).getMonth() + 1, 1).getTime()

  const data = useLiveQuery(
    async () => ({
      effects: await db.effects.where('timestamp').between(month, next, true, false).toArray(),
      checkIns: await db.checkIns.where('date').between(dayKey(month), dayKey(next), true, false).toArray(),
    }),
    [month, next],
  )
  const cells = useMemo(() => (data ? monthCells(month, data.effects, data.checkIns) : []), [data, month])
  const leading = (new Date(month).getDay() + 6) % 7
  const todayKey = dayKey(Date.now())
  const isCurrentMonth = next > Date.now()
  const withData = cells.filter((c) => c.score !== undefined)

  const shift = (delta: number) => {
    const d = new Date(month)
    setMonth(new Date(d.getFullYear(), d.getMonth() + delta, 1).getTime())
    setSelected(null)
  }

  return (
    <ChartCard
      title="Month mosaic"
      description="Each day as a tile, shaded by the effects you logged and your evening mood."
      controls={
        <div className="flex items-center justify-between">
          <IconButton icon="back" label="Previous month" onClick={() => shift(-1)} />
          <span className="font-medium">{new Date(month).toLocaleDateString(undefined, { month: 'long', year: 'numeric' })}</span>
          <IconButton icon="chevron" label="Next month" onClick={() => shift(1)} disabled={isCurrentMonth} className="disabled:opacity-30" />
        </div>
      }
      legend={
        <div className="flex items-center gap-2 text-[13px] text-muted">
          <span>Harder</span>
          <span
            className="h-2.5 flex-1 rounded-full"
            style={{ background: `linear-gradient(90deg, ${scoreColour(-1)}, ${scoreColour(0)}, ${scoreColour(1)})` }}
          />
          <span>Better</span>
          <span className="ml-2 h-3 w-3 rounded-[4px] bg-surface-2" />
          <span>No entries</span>
        </div>
      }
      table={
        withData.length > 0 && (
          <table className={tableClass}>
            <thead>
              <tr>
                <th>Day</th>
                <th>Effects</th>
                <th>Mood</th>
                <th>Overall</th>
              </tr>
            </thead>
            <tbody>
              {withData.map((c) => (
                <tr key={c.key}>
                  <td>{new Date(c.ts).getDate()}</td>
                  <td>{c.effects}</td>
                  <td>{c.checkIn?.mood ?? '–'}</td>
                  <td>{describe(c.score)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )
      }
    >
      <div className="grid grid-cols-7 gap-1.5 text-center">
        {WEEKDAYS.map((w, i) => (
          <span key={i} className="pb-1 text-[12px] text-faint">
            {w}
          </span>
        ))}
        {Array.from({ length: leading }, (_, i) => (
          <span key={`blank-${i}`} />
        ))}
        {cells.map((c) => {
          const future = c.ts > Date.now()
          return (
            <button
              key={c.key}
              type="button"
              disabled={future}
              onClick={() => setSelected(selected?.key === c.key ? null : c)}
              aria-label={`${new Date(c.ts).toLocaleDateString()}: ${describe(c.score)}`}
              className={`flex aspect-square min-h-10 items-start justify-start rounded-[10px] p-1.5 text-[11px] transition-all duration-500 ${
                selected?.key === c.key ? 'ring-2 ring-ink/40' : ''
              } ${future ? 'opacity-40' : ''} ${c.key === todayKey ? 'font-bold text-ink' : 'text-ink/60'}`}
              style={{ backgroundColor: future ? 'transparent' : scoreColour(c.score), border: future ? '1px dashed var(--border)' : undefined }}
            >
              {new Date(c.ts).getDate()}
            </button>
          )
        })}
      </div>
      <p className="mt-3 min-h-6 text-[15px] text-muted" aria-live="polite">
        {selected
          ? `${new Date(selected.ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}: ${describe(selected.score)}${
              selected.effects ? ` · ${selected.effects} ${selected.effects === 1 ? 'effect' : 'effects'}` : ''
            }${selected.checkIn ? ` · mood ${selected.checkIn.mood}` : ''}`
          : withData.length === 0
            ? 'Days with logged effects or a check-in will be shaded here.'
            : 'Tap a day for details.'}
      </p>
    </ChartCard>
  )
}
