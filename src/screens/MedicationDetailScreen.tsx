import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { MedicationForm } from '../components/MedicationForm'
import { setArchived } from '../data/medications'
import { useMedications } from '../data/hooks'
import { db } from '../db/db'
import { addDays, formatDateTime, formatShortDate, startOfDay } from '../lib/time'
import { goBack } from '../router'
import { medColour } from '../ui/colours'
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
  const recent = useLiveQuery(
    async () => (await db.doseLogs.where('medicationId').equals(id).toArray()).filter((l) => l.timestamp >= since),
    [id, since],
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
      </Page>
      {editing && <MedicationForm medication={med} onClose={() => setEditing(false)} />}
    </>
  )
}
