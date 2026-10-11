import type { DoseLog, EffectEntry, Medication, Note, Tag } from '../db/types'
import { formatTime } from '../lib/time'
import { describeSinceDose, sinceDoseForMedication, type SinceDose } from '../lib/timeSinceDose'
import { FEEL_LABELS, feelColour, medColour } from '../ui/colours'
import { Icon } from '../ui/Icon'

export type TimelineItem =
  | { kind: 'dose'; at: number; log: DoseLog }
  | { kind: 'effect'; at: number; entry: EffectEntry }
  | { kind: 'note'; at: number; note: Note }

export function buildTimeline(parts: {
  doseLogs?: DoseLog[]
  effects?: EffectEntry[]
  notes?: Note[]
}): TimelineItem[] {
  const items: TimelineItem[] = [
    ...(parts.doseLogs ?? []).map((log) => ({ kind: 'dose' as const, at: log.timestamp, log })),
    ...(parts.effects ?? []).map((entry) => ({ kind: 'effect' as const, at: entry.timestamp, entry })),
    ...(parts.notes ?? []).map((note) => ({ kind: 'note' as const, at: note.createdAt, note })),
  ]
  return items.sort((a, b) => a.at - b.at)
}

export interface TimelineContext {
  medications: Medication[]
  tags: Tag[]
  /** Taken dose logs per medication, sorted (see indexDoseLogs). */
  doseIndex: Map<string, DoseLog[]>
}

/** Time since dose for an effect, using the index; linked medications only unless "not sure". */
export function sinceDoseFor(entry: EffectEntry, ctx: TimelineContext): SinceDose[] {
  const medIds = entry.medicationIds.length ? entry.medicationIds : ctx.medications.map((m) => m.id)
  return medIds
    .map((id) => sinceDoseForMedication(entry.timestamp, ctx.doseIndex.get(id)))
    .filter((s): s is SinceDose => !!s)
    .sort((a, b) => a.elapsed - b.elapsed)
}

export function Timeline({
  items,
  ctx,
  onSelect,
}: {
  items: TimelineItem[]
  ctx: TimelineContext
  onSelect?: (item: TimelineItem) => void
}) {
  return (
    <ol className="relative">
      <span className="absolute bottom-3 left-[4.25rem] top-3 w-px bg-line" aria-hidden="true" />
      {items.map((item) => (
        <li key={`${item.kind}-${keyOf(item)}`} className="animate-fade relative flex gap-3 py-1.5">
          <time className="w-14 shrink-0 pt-3.5 text-right text-sm tabular-nums text-faint">{formatTime(item.at)}</time>
          <span
            className="relative z-10 mt-[1.15rem] h-2.5 w-2.5 shrink-0 rounded-full ring-4 ring-bg"
            style={{ backgroundColor: dotColour(item, ctx) }}
            aria-hidden="true"
          />
          <button
            type="button"
            onClick={() => onSelect?.(item)}
            className="min-h-11 flex-1 rounded-2xl bg-surface px-4 py-3 text-left transition-colors duration-300 active:bg-surface-2"
          >
            <ItemBody item={item} ctx={ctx} />
          </button>
        </li>
      ))}
    </ol>
  )
}

function keyOf(item: TimelineItem) {
  switch (item.kind) {
    case 'dose':
      return item.log.id
    case 'effect':
      return item.entry.id
    case 'note':
      return item.note.id
  }
}

function dotColour(item: TimelineItem, ctx: TimelineContext) {
  switch (item.kind) {
    case 'dose': {
      const med = ctx.medications.find((m) => m.id === item.log.medicationId)
      return item.log.status === 'skipped' ? 'var(--surface-2)' : med ? medColour(med.colour) : 'var(--faint)'
    }
    case 'effect':
      return feelColour(item.entry.feel)
    default:
      return 'var(--faint)'
  }
}

function ItemBody({ item, ctx }: { item: TimelineItem; ctx: TimelineContext }) {
  switch (item.kind) {
    case 'dose': {
      const med = ctx.medications.find((m) => m.id === item.log.medicationId)
      const skipped = item.log.status === 'skipped'
      return (
        <div className={skipped ? 'text-muted' : ''}>
          <span className="font-medium">{med?.name ?? 'Medication'}</span>
          <span className="text-muted">
            {' · '}
            {skipped ? 'skipped' : `${item.log.amount} ${item.log.unit}`}
          </span>
        </div>
      )
    }
    case 'effect':
      return <EffectBody entry={item.entry} ctx={ctx} />
    case 'note': {
      const med = ctx.medications.find((m) => m.id === item.note.medicationId)
      return (
        <div>
          <div className="mb-1 flex items-center gap-1.5 text-sm text-muted">
            <Icon name="note" size={16} />
            {med ? `Note on ${med.name}` : 'Day note'}
          </div>
          <p className="line-clamp-4 whitespace-pre-wrap">{item.note.text}</p>
        </div>
      )
    }
  }
}

export function EffectBody({ entry, ctx }: { entry: EffectEntry; ctx: TimelineContext }) {
  const tags = entry.tagIds.map((id) => ctx.tags.find((t) => t.id === id)?.name).filter(Boolean) as string[]
  const meds = entry.medicationIds.map((id) => ctx.medications.find((m) => m.id === id)).filter((m): m is Medication => !!m)
  const since = sinceDoseFor(entry, ctx)
  return (
    <div>
      {entry.text ? (
        <p className="whitespace-pre-wrap">{entry.text}</p>
      ) : (
        <p className="text-muted">{tags.join(', ') || 'Noticed something'}</p>
      )}
      <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
        <span className="rounded-full px-2 py-0.5" style={{ backgroundColor: `color-mix(in srgb, ${feelColour(entry.feel)} 22%, transparent)` }}>
          {FEEL_LABELS[entry.feel]}
          {entry.strength ? ` · ${'●'.repeat(entry.strength)}${'○'.repeat(3 - entry.strength)}` : ''}
        </span>
        {entry.text &&
          tags.map((t) => (
            <span key={t} className="rounded-full bg-surface-2 px-2 py-0.5 text-muted">
              {t}
            </span>
          ))}
      </div>
      <p className="mt-1.5 text-[13px] text-muted">
        {meds.length === 0 ? (
          <>
            Not sure which medication
            {since.length > 0 && <> · {since.map((s) => describeSinceDose(s, ctx.medications)).join(', ')}</>}
          </>
        ) : (
          // Linked: "2h 10m after X", or just the name when there was no dose in the previous 24 hours.
          meds
            .map((m) => {
              const s = since.find((x) => x.medicationId === m.id)
              return s ? describeSinceDose(s, ctx.medications) : m.name
            })
            .join(' · ')
        )}
      </p>
    </div>
  )
}
