import { useMemo, useState } from 'react'
import { DoseEditSheet } from '../components/DoseEditSheet'
import { MedicationCard } from '../components/MedicationCard'
import { MedicationForm } from '../components/MedicationForm'
import { buildTimeline, Timeline, type TimelineContext, type TimelineItem } from '../components/Timeline'
import { useActiveMedications, useDoseLogs, useMedications, useTags } from '../data/hooks'
import type { DoseLog } from '../db/types'
import { addDays, DAY, startOfDay } from '../lib/time'
import { indexDoseLogs } from '../lib/timeSinceDose'
import { useNow } from '../lib/useNow'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, EmptyState, SectionTitle } from '../ui/primitives'

export function TodayScreen() {
  const now = useNow()
  const dayStart = startOfDay(now)
  const dayEnd = addDays(dayStart, 1)

  const allMeds = useMedications()
  const meds = useActiveMedications()
  const tags = useTags()
  // Include the previous 24 hours so "time since dose" works early in the day.
  const doseLogs = useDoseLogs(dayStart - DAY, dayEnd)

  const [editingLog, setEditingLog] = useState<DoseLog | null>(null)
  const [addingMed, setAddingMed] = useState(false)

  const todayLogs = useMemo(() => (doseLogs ?? []).filter((l) => l.timestamp >= dayStart), [doseLogs, dayStart])
  const ctx: TimelineContext = useMemo(
    () => ({ medications: allMeds ?? [], tags: tags ?? [], doseIndex: indexDoseLogs(doseLogs ?? []) }),
    [allMeds, tags, doseLogs],
  )
  const items = useMemo(() => buildTimeline({ doseLogs: todayLogs }), [todayLogs])

  const select = (item: TimelineItem) => {
    if (item.kind === 'dose') setEditingLog(item.log)
  }

  if (!meds) return null

  return (
    <>
      <ScreenHeader
        title="Today"
        subtitle={new Date(now).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}
      />
      <Page>
        {meds.length === 0 ? (
          <EmptyState icon="pill" title="Add your medications to begin">
            Each medication gets a card here with a one-tap “Taken” button.
            <Button variant="primary" icon="plus" className="mt-4 w-full" onClick={() => setAddingMed(true)}>
              Add medication
            </Button>
          </EmptyState>
        ) : (
          <div className="space-y-3">
            {meds.map((m) => (
              <MedicationCard
                key={m.id}
                medication={m}
                todayLogs={todayLogs.filter((l) => l.medicationId === m.id)}
                onEditLog={setEditingLog}
              />
            ))}
          </div>
        )}

        <SectionTitle>Today so far</SectionTitle>
        {items.length === 0 ? (
          <EmptyState title="Nothing logged yet today">Doses and the effects you notice will line up here in time order.</EmptyState>
        ) : (
          <Timeline items={items} ctx={ctx} onSelect={select} />
        )}
      </Page>

      {editingLog && (
        <DoseEditSheet
          log={editingLog}
          medication={allMeds?.find((m) => m.id === editingLog.medicationId)}
          onClose={() => setEditingLog(null)}
        />
      )}
      {addingMed && <MedicationForm onClose={() => setAddingMed(false)} usedColours={allMeds?.map((m) => m.colour)} />}
    </>
  )
}
