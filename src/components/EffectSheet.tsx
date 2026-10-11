import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { deleteEffect, ensureTags, normaliseTagName, restoreEffect, saveEffect, tagUsage } from '../data/entries'
import { useMedications, useTags } from '../data/hooks'
import type { EffectEntry, Feel } from '../db/types'
import { formatTime, fromDateTimeLocal, toDateTimeLocal } from '../lib/time'
import { FEEL_LABELS, feelColour, medColour } from '../ui/colours'
import { useFeedback } from '../ui/feedback'
import { Button, Chip, inputClass } from '../ui/primitives'
import { Sheet, useCloseSheet } from '../ui/Sheet'

const FEELS: Feel[] = ['good', 'neutral', 'bad']
const STRENGTHS = [
  { value: 1 as const, label: 'Mild' },
  { value: 2 as const, label: 'Moderate' },
  { value: 3 as const, label: 'Strong' },
]
const QUICK_TAG_COUNT = 10

/**
 * "I noticed something". Defaults (now, neutral, not sure) mean that after
 * typing, saving takes at most two taps: pick a feel, then Save.
 */
export function EffectSheet({ entry, onClose }: { entry?: EffectEntry; onClose: () => void }) {
  const meds = useMedications()
  const tags = useTags()
  const usage = useLiveQuery(tagUsage)
  const { toast } = useFeedback()

  const [openedAt] = useState(Date.now)
  const [text, setText] = useState(entry?.text ?? '')
  const [feel, setFeel] = useState<Feel>(entry?.feel ?? 'neutral')
  const [strength, setStrength] = useState<1 | 2 | 3 | undefined>(entry?.strength)
  const [tagIds, setTagIds] = useState<string[]>(entry?.tagIds ?? [])
  const [newTags, setNewTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [showAllTags, setShowAllTags] = useState(false)
  const [medIds, setMedIds] = useState<string[]>(entry?.medicationIds ?? [])
  const [editTime, setEditTime] = useState(false)
  const [at, setAt] = useState(toDateTimeLocal(entry?.timestamp ?? openedAt))

  const sortedTags = useMemo(
    () => [...(tags ?? [])].sort((a, b) => (usage?.get(b.id) ?? 0) - (usage?.get(a.id) ?? 0) || a.name.localeCompare(b.name)),
    [tags, usage],
  )
  const visibleTags = showAllTags ? sortedTags : sortedTags.slice(0, QUICK_TAG_COUNT)
  // Keep selected tags visible even when they are not among the most used.
  const extraSelected = sortedTags.filter((t) => tagIds.includes(t.id) && !visibleTags.includes(t))

  const activeMeds = (meds ?? []).filter((m) => !m.isArchived || medIds.includes(m.id))
  const canSave = text.trim().length > 0 || tagIds.length > 0 || newTags.length > 0

  const addDraftTag = () => {
    const name = normaliseTagName(tagDraft)
    if (!name) return
    const existing = tags?.find((t) => t.name === name)
    if (existing) setTagIds((ids) => (ids.includes(existing.id) ? ids : [...ids, existing.id]))
    else if (!newTags.includes(name)) setNewTags([...newTags, name])
    setTagDraft('')
  }

  const toggle = (list: string[], id: string) => (list.includes(id) ? list.filter((x) => x !== id) : [...list, id])

  const save = async () => {
    const draft = normaliseTagName(tagDraft)
    const created = await ensureTags(draft ? [...newTags, draft] : newTags)
    await saveEffect({
      id: entry?.id,
      timestamp: editTime || entry ? fromDateTimeLocal(at) : openedAt,
      text: text.trim(),
      feel,
      strength,
      tagIds: [...new Set([...tagIds, ...created])],
      medicationIds: medIds,
    })
    toast(entry ? 'Entry updated' : 'Saved')
  }

  return (
    <Sheet title={entry ? 'Edit entry' : 'I noticed something'} onClose={onClose} actionLabel="Save" onAction={save} actionDisabled={!canSave}>
      <div className="space-y-6 pt-1">
        <textarea
          className={`${inputClass} min-h-28 resize-none leading-snug`}
          placeholder="What did you notice?"
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={!entry}
          rows={3}
        />

        <div>
          <Label>How did it feel?</Label>
          <div className="grid grid-cols-3 gap-2">
            {FEELS.map((f) => (
              <button
                key={f}
                type="button"
                aria-pressed={feel === f}
                onClick={() => setFeel(f)}
                className={`min-h-12 rounded-2xl border text-[15px] font-medium transition-all duration-300 ${
                  feel === f ? 'border-transparent text-ink' : 'border-line bg-surface text-muted'
                }`}
                style={feel === f ? { backgroundColor: `color-mix(in srgb, ${feelColour(f)} 40%, var(--surface))` } : undefined}
              >
                {FEEL_LABELS[f]}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label>Tags</Label>
          <div className="flex flex-wrap gap-2">
            {[...visibleTags, ...extraSelected].map((t) => (
              <Chip key={t.id} selected={tagIds.includes(t.id)} onClick={() => setTagIds(toggle(tagIds, t.id))}>
                {t.name}
              </Chip>
            ))}
            {newTags.map((name) => (
              <Chip key={`new-${name}`} selected onClick={() => setNewTags(newTags.filter((n) => n !== name))}>
                {name}
              </Chip>
            ))}
            {sortedTags.length > QUICK_TAG_COUNT && (
              <button type="button" className="min-h-11 px-2 text-[15px] text-accent" onClick={() => setShowAllTags(!showAllTags)}>
                {showAllTags ? 'Fewer' : `All ${sortedTags.length}`}
              </button>
            )}
          </div>
          <div className="mt-2 flex gap-2">
            <input
              className={inputClass}
              placeholder="New tag"
              value={tagDraft}
              enterKeyHint="done"
              onChange={(e) => setTagDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  addDraftTag()
                }
              }}
            />
            {tagDraft.trim() && <Button onClick={addDraftTag}>Add</Button>}
          </div>
        </div>

        <div>
          <Label>Which medication?</Label>
          <div className="flex flex-wrap gap-2">
            {activeMeds.map((m) => (
              <Chip key={m.id} selected={medIds.includes(m.id)} colour={medColour(m.colour)} onClick={() => setMedIds(toggle(medIds, m.id))}>
                {m.name}
              </Chip>
            ))}
            <Chip selected={medIds.length === 0} onClick={() => setMedIds([])}>
              Not sure
            </Chip>
          </div>
        </div>

        <div>
          <Label>Strength (optional)</Label>
          <div className="flex flex-wrap gap-2">
            {STRENGTHS.map((s) => (
              <Chip key={s.value} selected={strength === s.value} onClick={() => setStrength(strength === s.value ? undefined : s.value)}>
                {s.label}
              </Chip>
            ))}
          </div>
        </div>

        <div>
          <Label>Time</Label>
          {editTime || entry ? (
            <input className={inputClass} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
          ) : (
            <button
              type="button"
              onClick={() => setEditTime(true)}
              className="flex min-h-11 w-full items-center justify-between rounded-2xl bg-surface px-4 text-left"
            >
              <span>Now, {formatTime(openedAt)}</span>
              <span className="text-[15px] text-accent">Change</span>
            </button>
          )}
        </div>

        {entry && <DeleteEffect entry={entry} />}
      </div>
    </Sheet>
  )
}

function Label({ children }: { children: string }) {
  return <p className="mb-2 text-[15px] text-muted">{children}</p>
}

function DeleteEffect({ entry }: { entry: EffectEntry }) {
  const close = useCloseSheet()
  const { toast } = useFeedback()
  return (
    <Button
      variant="quiet-danger"
      className="w-full"
      onClick={async () => {
        await deleteEffect(entry.id)
        close()
        toast('Entry removed', { label: 'Undo', onClick: () => restoreEffect(entry) })
      }}
    >
      Remove this entry
    </Button>
  )
}
