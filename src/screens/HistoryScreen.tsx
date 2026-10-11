import { useLiveQuery } from 'dexie-react-hooks'
import { useDeferredValue, useMemo, useState } from 'react'
import { useEntryEditor } from '../components/EntryEditor'
import { buildTimeline, Timeline, type TimelineContext } from '../components/Timeline'
import { tagUsage } from '../data/entries'
import { useMedications, useTags } from '../data/hooks'
import { db } from '../db/db'
import type { CheckIn, DoseLog, EffectEntry, Note } from '../db/types'
import { effectMatches, isEmptyQuery, noteMatches, parseQuery, tagQuery } from '../lib/search'
import { addDays, DAY, dayKey, dayKeyToTs, formatDay, startOfDay } from '../lib/time'
import { indexDoseLogs } from '../lib/timeSinceDose'
import { Icon } from '../ui/Icon'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, Chip, EmptyState, inputClass } from '../ui/primitives'

const PAGE_DAYS = 14

interface DayGroup {
  key: string
  doseLogs: DoseLog[]
  effects: EffectEntry[]
  notes: Note[]
  checkIn?: CheckIn
}

export function HistoryScreen() {
  const meds = useMedications()
  const tags = useTags()
  const usage = useLiveQuery(tagUsage)
  const editor = useEntryEditor(meds)

  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)
  const parsed = useMemo(() => parseQuery(deferredQuery), [deferredQuery])
  const searching = !isEmptyQuery(parsed)
  const [days, setDays] = useState(PAGE_DAYS)

  const today = startOfDay(Date.now())
  const from = searching ? 0 : addDays(today, -(days - 1))
  const to = addDays(today, 1)

  const data = useLiveQuery(async () => {
    const [doseLogs, effects, notes, checkIns, earliest] = await Promise.all([
      db.doseLogs.where('timestamp').between(from - DAY, to, true, false).toArray(),
      db.effects.where('timestamp').between(from, to, true, false).toArray(),
      db.notes.where('createdAt').between(from, to, true, false).toArray(),
      db.checkIns.where('date').between(dayKey(from), dayKey(to), true, false).toArray(),
      Promise.all([db.doseLogs.orderBy('timestamp').first(), db.effects.orderBy('timestamp').first(), db.notes.orderBy('createdAt').first()]),
    ])
    const earliestTs = Math.min(
      ...earliest.map((r) => (r ? ('timestamp' in r ? r.timestamp : r.createdAt) : Infinity)),
    )
    return { doseLogs, effects, notes, checkIns, earliestTs }
  }, [from, to])

  const tagsById = useMemo(() => new Map((tags ?? []).map((t) => [t.id, t])), [tags])
  const ctx: TimelineContext = useMemo(
    () => ({ medications: meds ?? [], tags: tags ?? [], doseIndex: indexDoseLogs(data?.doseLogs ?? []) }),
    [meds, tags, data?.doseLogs],
  )

  const groups = useMemo(() => {
    if (!data) return []
    const byDay = new Map<string, DayGroup>()
    const group = (key: string) => {
      if (!byDay.has(key)) byDay.set(key, { key, doseLogs: [], effects: [], notes: [] })
      return byDay.get(key)!
    }
    if (searching) {
      for (const e of data.effects) if (effectMatches(e, parsed, tagsById)) group(dayKey(e.timestamp)).effects.push(e)
      for (const n of data.notes) if (noteMatches(n, parsed)) group(dayKey(n.createdAt)).notes.push(n)
    } else {
      // Every day in range, newest first, even quiet ones.
      for (let d = today; d >= from; d = addDays(d, -1)) group(dayKey(d))
      for (const l of data.doseLogs) if (l.timestamp >= from) group(dayKey(l.timestamp)).doseLogs.push(l)
      for (const e of data.effects) group(dayKey(e.timestamp)).effects.push(e)
      for (const n of data.notes) group(dayKey(n.createdAt)).notes.push(n)
      for (const c of data.checkIns) if (byDay.has(c.date)) byDay.get(c.date)!.checkIn = c
    }
    return [...byDay.values()].sort((a, b) => b.key.localeCompare(a.key))
  }, [data, searching, parsed, tagsById, today, from])

  const topTags = useMemo(
    () => [...(tags ?? [])].sort((a, b) => (usage?.get(b.id) ?? 0) - (usage?.get(a.id) ?? 0)).slice(0, 8),
    [tags, usage],
  )
  const hasEarlier = !searching && data && data.earliestTs < from

  return (
    <>
      <ScreenHeader title="History" />
      <Page>
        <div className="relative">
          <Icon name="search" size={20} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" />
          <input
            type="search"
            className={`${inputClass} pl-11`}
            placeholder="Search text or #tag"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
          />
        </div>
        {topTags.length > 0 && (
          <div className="-mx-5 mt-3 flex gap-2 overflow-x-auto px-5 pb-1">
            {topTags.map((t) => {
              const q = tagQuery(t.name)
              return (
                <Chip key={t.id} selected={query.trim() === q} onClick={() => setQuery(query.trim() === q ? '' : q)}>
                  <span className="whitespace-nowrap">{t.name}</span>
                </Chip>
              )
            })}
          </div>
        )}

        <div className="mt-6 space-y-8">
          {!data ? null : searching && groups.length === 0 ? (
            <EmptyState title="No matches">Try fewer words, or tap a tag above.</EmptyState>
          ) : !searching && data.earliestTs === Infinity ? (
            <EmptyState icon="history" title="Your history will appear here">
              Every day you log doses, effects or notes gets its own section, newest first.
            </EmptyState>
          ) : (
            groups.map((g) => <DaySection key={g.key} group={g} ctx={ctx} onSelect={editor.edit} />)
          )}
        </div>

        {hasEarlier && (
          <Button className="mt-8 w-full" onClick={() => setDays(days + PAGE_DAYS)}>
            Show earlier days
          </Button>
        )}
      </Page>
      {editor.sheet}
    </>
  )
}

function DaySection({ group, ctx, onSelect }: { group: DayGroup; ctx: TimelineContext; onSelect: Parameters<typeof Timeline>[0]['onSelect'] }) {
  const items = buildTimeline(group)
  const c = group.checkIn
  return (
    <section className="animate-fade">
      <h2 className="px-1 text-lg font-semibold">{formatDay(dayKeyToTs(group.key))}</h2>
      {c && (
        <p className="mt-0.5 px-1 text-[15px] text-muted">
          Check-in: focus {c.focus}, anxiety {c.anxiety}, mood {c.mood}, sleep {c.sleep}
        </p>
      )}
      {items.length === 0 ? (
        <p className="mt-1 px-1 text-[15px] text-faint">Nothing logged</p>
      ) : (
        <div className="mt-2">
          <Timeline items={items} ctx={ctx} onSelect={onSelect} />
        </div>
      )}
    </section>
  )
}
