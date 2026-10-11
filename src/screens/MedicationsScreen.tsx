import { useState } from 'react'
import { MedicationForm } from '../components/MedicationForm'
import { useMedications } from '../data/hooks'
import type { Medication } from '../db/types'
import { navigate } from '../router'
import { medColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, EmptyState, SectionTitle } from '../ui/primitives'

export function MedicationsScreen() {
  const meds = useMedications()
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)
  if (!meds) return null

  const active = meds.filter((m) => !m.isArchived)
  const archived = meds.filter((m) => m.isArchived)

  return (
    <>
      <ScreenHeader title="Medications" />
      <Page>
        {active.length === 0 ? (
          <EmptyState icon="pill" title="No medications yet">
            Add the medications you take. Each one gets its own page with dose history, linked effects, notes and
            graphs.
          </EmptyState>
        ) : (
          <ul className="space-y-3">
            {active.map((m) => (
              <MedicationRow key={m.id} medication={m} />
            ))}
          </ul>
        )}

        <Button variant="primary" icon="plus" className="mt-5 w-full" onClick={() => setAdding(true)}>
          Add medication
        </Button>

        {archived.length > 0 && (
          <>
            <SectionTitle
              action={
                <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
                  {showArchived ? 'Hide' : `Show ${archived.length}`}
                </Button>
              }
            >
              Archived
            </SectionTitle>
            {showArchived && (
              <ul className="space-y-3">
                {archived.map((m) => (
                  <MedicationRow key={m.id} medication={m} />
                ))}
              </ul>
            )}
          </>
        )}
      </Page>
      {adding && (
        <MedicationForm
          onClose={() => setAdding(false)}
          usedColours={meds.map((m) => m.colour)}
          onSaved={(id) => navigate({ name: 'medication', id })}
        />
      )}
    </>
  )
}

function MedicationRow({ medication: m }: { medication: Medication }) {
  return (
    <li className="animate-fade">
      <button
        type="button"
        onClick={() => navigate({ name: 'medication', id: m.id })}
        className={`flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left transition-colors duration-300 active:bg-surface-2 ${
          m.isArchived ? 'opacity-70' : ''
        }`}
      >
        <span className="h-10 w-10 shrink-0 rounded-2xl" style={{ backgroundColor: medColour(m.colour) }} />
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{m.name}</p>
          <p className="truncate text-[15px] text-muted">
            {m.doseAmount} {m.unit}
            {m.purpose && ` · ${m.purpose}`}
          </p>
        </div>
        <Icon name="chevron" className="text-faint" />
      </button>
    </li>
  )
}
