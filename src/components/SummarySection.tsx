import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useRef, useState } from 'react'
import { generateSummary, getApiKey } from '../data/summaries'
import { db } from '../db/db'
import type { Medication } from '../db/types'
import { countEntries, MIN_EFFECT_ENTRIES, type Period, type SummaryScopeInput } from '../lib/summary/aggregate'
import { SummaryError } from '../lib/summary/provider'
import { addDays, formatShortDate, startOfDay, startOfWeek } from '../lib/time'
import { navigate } from '../router'
import { medColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { Button, Chip, inputClass, SectionTitle } from '../ui/primitives'

export function weekOptions(now = Date.now()): { label: string; period: Period }[] {
  const end = addDays(startOfDay(now), 1)
  const options = [{ label: 'Last 7 days', period: { start: addDays(end, -7), end } }]
  const monday = startOfWeek(now)
  for (let i = 1; i <= 6; i++) {
    const start = addDays(monday, -7 * i)
    options.push({ label: `Week of ${formatShortDate(start)}`, period: { start, end: addDays(start, 7) } })
  }
  return options
}

export function scopeLabel(scope: string, meds: Medication[]) {
  return scope === 'overall' ? 'Overall' : (meds.find((m) => m.id === scope)?.name ?? 'A medication')
}

/** Weekly AI summary on demand, per medication or overall, plus the saved ones. */
export function SummarySection({ medications }: { medications: Medication[] }) {
  const weeks = useMemo(() => weekOptions(), [])
  const [weekIndex, setWeekIndex] = useState(0)
  const [scope, setScope] = useState<SummaryScopeInput>({ kind: 'overall' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const abort = useRef<AbortController | null>(null)
  const period = weeks[weekIndex].period

  const hasKey = useLiveQuery(async () => !!(await getApiKey()))
  const entryCount = useLiveQuery(
    async () => countEntries(await db.effects.where('timestamp').between(period.start, period.end, true, false).toArray(), scope, period),
    [period.start, period.end, scope],
  )
  const saved = useLiveQuery(() => db.summaries.orderBy('createdAt').reverse().toArray())
  const active = medications.filter((m) => !m.isArchived)
  const enough = (entryCount ?? 0) >= MIN_EFFECT_ENTRIES

  const generate = async () => {
    setMessage(null)
    setBusy(true)
    abort.current = new AbortController()
    try {
      const result = await generateSummary(scope, period, abort.current.signal)
      if (result.kind === 'not-enough') setMessage(result.text)
      else navigate({ name: 'summary', id: result.id })
    } catch (err) {
      setMessage(err instanceof SummaryError ? err.message : 'Something went wrong while generating the summary. Nothing was saved.')
    } finally {
      setBusy(false)
      abort.current = null
    }
  }

  return (
    <>
      <SectionTitle>Weekly summary</SectionTitle>
      <section className="animate-fade rounded-3xl bg-surface p-5">
        <p className="text-[15px] text-muted">
          A short write-up of the patterns in one week: what stood out, timing, wanted and unwanted effects, changes since
          the week before, and points to raise with your prescriber.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          <Chip selected={scope.kind === 'overall'} onClick={() => setScope({ kind: 'overall' })}>
            Overall
          </Chip>
          {active.map((m) => (
            <Chip
              key={m.id}
              colour={medColour(m.colour)}
              selected={scope.kind === 'medication' && scope.medicationId === m.id}
              onClick={() => setScope({ kind: 'medication', medicationId: m.id })}
            >
              {m.name}
            </Chip>
          ))}
        </div>

        <select
          className={`${inputClass} mt-3 appearance-none`}
          value={weekIndex}
          onChange={(e) => setWeekIndex(Number(e.target.value))}
          aria-label="Week"
        >
          {weeks.map((w, i) => (
            <option key={i} value={i}>
              {w.label} ({formatShortDate(w.period.start)} – {formatShortDate(w.period.end - 1)})
            </option>
          ))}
        </select>

        <p className="mt-3 text-[15px] text-muted">
          {entryCount === undefined
            ? ' '
            : enough
              ? `Based on ${entryCount} effect ${entryCount === 1 ? 'entry' : 'entries'}.`
              : `Not enough data yet: this week has ${entryCount} effect ${entryCount === 1 ? 'entry' : 'entries'} here, and a summary needs at least ${MIN_EFFECT_ENTRIES}.`}
        </p>

        {hasKey === false ? (
          <Button className="mt-4 w-full" icon="settings" onClick={() => navigate({ name: 'settings' })}>
            Add your Claude API key in Settings
          </Button>
        ) : busy ? (
          <div className="mt-4 flex items-center justify-between gap-3 rounded-2xl bg-accent-soft px-4 py-3">
            <span className="flex items-center gap-2 text-[15px]">
              <Icon name="sparkle" size={18} className="animate-pulse text-accent" />
              Writing the summary. This can take up to a minute.
            </span>
            <Button variant="ghost" onClick={() => abort.current?.abort()}>
              Cancel
            </Button>
          </div>
        ) : (
          <Button variant="primary" icon="sparkle" className="mt-4 w-full" disabled={!enough || hasKey === undefined} onClick={generate}>
            Generate
          </Button>
        )}
        {message && (
          <p className="mt-3 rounded-2xl bg-surface-2 px-4 py-3 text-[15px]" role="status">
            {message}
          </p>
        )}
        <p className="mt-3 text-[13px] text-faint">
          Generating sends the week’s counts and up to a dozen short excerpts of your entries to Anthropic, using your key.
          Nothing leaves the phone until you tap Generate.
        </p>
      </section>

      {saved && saved.length > 0 && (
        <ul className="mt-3 space-y-2">
          {saved.map((s) => (
            <li key={s.id}>
              <button
                type="button"
                onClick={() => navigate({ name: 'summary', id: s.id })}
                className="flex min-h-14 w-full items-center gap-3 rounded-2xl bg-surface px-4 py-3 text-left"
              >
                <span className="flex-1">
                  <span className="block font-medium">
                    {scopeLabel(s.scope, medications)} · {formatShortDate(s.periodStart)} – {formatShortDate(s.periodEnd - 1)}
                  </span>
                  <span className="block text-[13px] text-muted">
                    {s.entryCount} entries · written {formatShortDate(s.createdAt)}
                  </span>
                </span>
                <Icon name="chevron" size={18} className="text-faint" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </>
  )
}
