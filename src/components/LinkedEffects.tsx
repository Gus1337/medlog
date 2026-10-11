import { useState } from 'react'
import type { EffectEntry, Feel } from '../db/types'
import { formatDateTime } from '../lib/time'
import { FEEL_LABELS, feelColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { EffectBody, type TimelineContext } from './Timeline'

interface TagGroup {
  name: string
  entries: EffectEntry[]
  feels: Record<Feel, number>
}

export function groupByTag(entries: EffectEntry[], ctx: TimelineContext): TagGroup[] {
  const groups = new Map<string, TagGroup>()
  for (const e of entries) {
    const names = e.tagIds.map((id) => ctx.tags.find((t) => t.id === id)?.name).filter(Boolean) as string[]
    for (const name of names.length ? names : ['untagged']) {
      const g = groups.get(name) ?? { name, entries: [], feels: { good: 0, neutral: 0, bad: 0 } }
      g.entries.push(e)
      g.feels[e.feel]++
      groups.set(name, g)
    }
  }
  return [...groups.values()].sort((a, b) => b.entries.length - a.entries.length)
}

/** Effects linked to one medication, grouped by tag; tap a group to see its entries. */
export function LinkedEffects({
  entries,
  ctx,
  onSelect,
}: {
  entries: EffectEntry[]
  ctx: TimelineContext
  onSelect: (entry: EffectEntry) => void
}) {
  const [open, setOpen] = useState<string | null>(null)
  const groups = groupByTag(entries, ctx)

  return (
    <ul className="space-y-2">
      {groups.map((g) => {
        const isOpen = open === g.name
        return (
          <li key={g.name} className="rounded-2xl bg-surface">
            <button
              type="button"
              onClick={() => setOpen(isOpen ? null : g.name)}
              aria-expanded={isOpen}
              className="flex min-h-14 w-full items-center gap-3 px-4 text-left"
            >
              <span className="flex-1 font-medium">{g.name}</span>
              <FeelBar feels={g.feels} />
              <span className="w-8 text-right tabular-nums text-muted">{g.entries.length}</span>
              <Icon name="chevron" size={18} className={`text-faint transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
            </button>
            {isOpen && (
              <ul className="animate-fade space-y-2 px-3 pb-3">
                {[...g.entries]
                  .sort((a, b) => b.timestamp - a.timestamp)
                  .map((e) => (
                    <li key={e.id}>
                      <button type="button" onClick={() => onSelect(e)} className="w-full rounded-xl bg-bg px-3 py-2.5 text-left">
                        <p className="mb-1 text-[13px] text-faint">{formatDateTime(e.timestamp)}</p>
                        <EffectBody entry={e} ctx={ctx} />
                      </button>
                    </li>
                  ))}
              </ul>
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** A small proportional bar of good / neutral / unwanted. */
export function FeelBar({ feels }: { feels: Record<Feel, number> }) {
  const total = feels.good + feels.neutral + feels.bad
  const label = (['good', 'neutral', 'bad'] as Feel[]).map((f) => `${feels[f]} ${FEEL_LABELS[f].toLowerCase()}`).join(', ')
  return (
    <span className="flex h-2 w-16 overflow-hidden rounded-full bg-surface-2" role="img" aria-label={label} title={label}>
      {(['good', 'neutral', 'bad'] as Feel[]).map((f) =>
        feels[f] ? <span key={f} style={{ width: `${(feels[f] / total) * 100}%`, backgroundColor: feelColour(f) }} /> : null,
      )}
    </span>
  )
}
