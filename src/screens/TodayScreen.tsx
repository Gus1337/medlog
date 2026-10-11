import { useMemo, useState } from 'react'
import { CheckInCard } from '../components/CheckInCard'
import { useEntryEditor } from '../components/EntryEditor'
import { HabitsSection } from '../components/HabitsSection'
import { MedicationCard } from '../components/MedicationCard'
import { MedicationForm } from '../components/MedicationForm'
import { buildTimeline, Timeline, type TimelineContext } from '../components/Timeline'
import { useActiveMedications, useDoseLogs, useEffects, useMedications, useNotes, useTags } from '../data/hooks'
import { addDays, DAY, dayKey, startOfDay } from '../lib/time'
import { indexDoseLogs } from '../lib/timeSinceDose'
import { useNow } from '../lib/useNow'
import { Icon } from '../ui/Icon'
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
  const effects = useEffects(dayStart, dayEnd)
  const notes = useNotes(dayStart, dayEnd)

  const editor = useEntryEditor(allMeds)
  const [addingMed, setAddingMed] = useState(false)

  const todayLogs = useMemo(() => (doseLogs ?? []).filter((l) => l.timestamp >= dayStart), [doseLogs, dayStart])
  const ctx: TimelineContext = useMemo(
    () => ({ medications: allMeds ?? [], tags: tags ?? [], doseIndex: indexDoseLogs(doseLogs ?? []) }),
    [allMeds, tags, doseLogs],
  )
  const items = useMemo(() => buildTimeline({ doseLogs: todayLogs, effects, notes }), [todayLogs, effects, notes])

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
                onEditLog={editor.editDose}
              />
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={editor.newEffect}
          className="mt-5 flex min-h-20 w-full items-center justify-center gap-3 rounded-3xl bg-accent-soft text-lg font-semibold text-ink transition-transform duration-300 active:scale-[0.99]"
        >
          <Icon name="sparkle" size={24} className="text-accent" />I noticed something
        </button>

        <HabitsSection now={now} />

        <SectionTitle
          action={
            <Button variant="ghost" icon="note" className="-mr-2 text-[15px]" onClick={() => editor.newNote()}>
              Add note
            </Button>
          }
        >
          Today so far
        </SectionTitle>
        {items.length === 0 ? (
          <EmptyState title="Nothing logged yet today">Doses and the effects you notice will line up here in time order.</EmptyState>
        ) : (
          <Timeline items={items} ctx={ctx} onSelect={editor.edit} />
        )}

        <div className="mt-8">
          <CheckInCard date={dayKey(now)} />
        </div>
      </Page>

      {editor.sheet}
      {addingMed && <MedicationForm onClose={() => setAddingMed(false)} usedColours={allMeds?.map((m) => m.colour)} />}
    </>
  )
}
