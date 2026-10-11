import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { AfterDoseChart } from '../components/charts/AfterDoseChart'
import { EffectBreakdown } from '../components/charts/EffectBreakdown'
import { useEntryEditor } from '../components/EntryEditor'
import { LinkedEffects } from '../components/LinkedEffects'
import { MedicationForm } from '../components/MedicationForm'
import type { TimelineContext } from '../components/Timeline'
import { setArchived } from '../data/medications'
import { useMedications, useTags } from '../data/hooks'
import { db } from '../db/db'
import { addDays, formatDateTime, formatShortDate, startOfDay } from '../lib/time'
import { indexDoseLogs } from '../lib/timeSinceDose'
import { goBack } from '../router'
import { medColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { useFeedback } from '../ui/feedback'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, Card, EmptyState, SectionTitle } from '../ui/primitives'

export function MedicationDetailScreen({ id }: { id: string }) {
  const meds = useMedications()
  const med = meds?.find((m) => m.id === id)
  const { confirm, toast } = useFeedback()
  const [editing, setEditing] = useState(false)

  const changes = useLiveQuery(() => db.doseChanges.where('medicationId').equals(id).sortBy('date'), [id])
  const since = addDays(startOfDay(Date.now()), -13)
  const doseLogs = useLiveQuery(() => db.doseLogs.where('medicationId').equals(id).toArray(), [id])
  const recent = doseLogs?.filter((l) => l.timestamp >= since)
  const effects = useLiveQuery(() => db.effects.where('medicationIds').equals(id).toArray(), [id])
  const notes = useLiveQuery(() => db.notes.where('medicationId').equals(id).reverse().sortBy('createdAt'), [id])
  const tags = useTags()
  // Recent effects of any kind, so the after-dose graph can include "not sure" entries.
  const recentEffects = useLiveQuery(
    () => db.effects.where('timestamp').aboveOrEqual(addDays(startOfDay(Date.now()), -84)).toArray(),
    [],
  )
  const editor = useEntryEditor(meds)
  const ctx: TimelineContext = useMemo(
    () => ({ medications: meds ?? [], tags: tags ?? [], doseIndex: indexDoseLogs(doseLogs ?? []) }),
    [meds, tags, doseLogs],
  )

  if (!meds) return null
  if (!med) {
    return (
      <>
        <ScreenHeader title="Not found" onBack={() => goBack({ name: 'medications' })} />
        <Page>
          <EmptyState title="This medication no longer exists" />
        </Page>
      </>
    )
  }

  const taken = recent?.filter((l) => l.status === 'taken').length ?? 0
  const skipped = recent?.filter((l) => l.status === 'skipped').length ?? 0

  const toggleArchive = async () => {
    if (!med.isArchived) {
      const ok = await confirm({
        title: `Archive ${med.name}?`,
        message: 'It disappears from Today but all its history stays. You can restore it at any time.',
        confirmLabel: 'Archive',
      })
      if (!ok) return
    }
    await setArchived(med.id, !med.isArchived)
    toast(med.isArchived ? 'Restored' : 'Archived')
  }

  return (
    <>
      <ScreenHeader title={med.name} subtitle={med.purpose || undefined} onBack={() => goBack({ name: 'medications' })} />
      <Page>
        <Card>
          <div className="flex items-center gap-4">
            <span className="h-12 w-12 shrink-0 rounded-2xl" style={{ backgroundColor: medColour(med.colour) }} />
            <div>
              <p className="text-xl font-semibold">
                {med.doseAmount} {med.unit}
              </p>
              <p className="text-[15px] text-muted">
                {med.usualTimes.length ? `Usually ${med.usualTimes.join(', ')}` : 'No usual time'} · since{' '}
                {formatShortDate(med.startDate)}
              </p>
            </div>
          </div>
          <p className="mt-4 text-[15px] text-muted">
            Last 14 days: {taken} taken{skipped > 0 && `, ${skipped} skipped`}
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button icon="edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button onClick={toggleArchive}>{med.isArchived ? 'Restore' : 'Archive'}</Button>
          </div>
        </Card>

        <SectionTitle>Dose history</SectionTitle>
        {changes && changes.length > 0 ? (
          <ol className="space-y-2">
            {[...changes].reverse().map((c, i, all) => {
              const prev = all[i + 1]
              return (
                <li key={c.id} className="flex items-center justify-between rounded-2xl bg-surface px-4 py-3">
                  <span>
                    {c.amount} {c.unit}
                    {prev && (
                      <span className="text-muted">
                        {' '}
                        (from {prev.amount} {prev.unit})
                      </span>
                    )}
                  </span>
                  <span className="text-[15px] text-muted">{prev ? formatDateTime(c.date) : `Started ${formatShortDate(c.date)}`}</span>
                </li>
              )
            })}
          </ol>
        ) : (
          <EmptyState title="No dose changes yet">When you edit the dose, the change is recorded here with its date.</EmptyState>
        )}

        {recentEffects && tags && doseLogs && (
          <>
            <SectionTitle>Last 12 weeks</SectionTitle>
            <div className="space-y-4">
              <AfterDoseChart medication={med} effects={recentEffects} doseLogs={doseLogs} tags={tags} />
              <EffectBreakdown medication={med} effects={recentEffects} tags={tags} />
            </div>
          </>
        )}

        <SectionTitle>Effects linked to {med.name}</SectionTitle>
        {effects && effects.length > 0 ? (
          <LinkedEffects entries={effects} ctx={ctx} onSelect={(entry) => editor.edit({ kind: 'effect', at: entry.timestamp, entry })} />
        ) : (
          <EmptyState title="No linked effects yet">
            When you log something you noticed and pick {med.name}, it is grouped here by tag.
          </EmptyState>
        )}

        <SectionTitle
          action={
            <Button variant="ghost" icon="plus" className="-mr-2 text-[15px]" onClick={() => editor.newNote(med.id)}>
              Add note
            </Button>
          }
        >
          Notes
        </SectionTitle>
        {notes && notes.length > 0 ? (
          <ul className="space-y-2">
            {notes.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => editor.edit({ kind: 'note', at: n.createdAt, note: n })}
                  className="w-full rounded-2xl bg-surface px-4 py-3 text-left"
                >
                  <p className="mb-1 flex items-center gap-1.5 text-[13px] text-faint">
                    <Icon name="note" size={14} />
                    {formatDateTime(n.createdAt)}
                  </p>
                  <p className="whitespace-pre-wrap">{n.text}</p>
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <EmptyState title="No notes yet">
            Longer thoughts about {med.name}, such as what your prescriber said, can be kept here.
          </EmptyState>
        )}
      </Page>
      {editing && <MedicationForm medication={med} onClose={() => setEditing(false)} />}
      {editor.sheet}
    </>
  )
}
