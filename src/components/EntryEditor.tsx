import { useState, type ReactNode } from 'react'
import type { DoseLog, EffectEntry, Medication, Note } from '../db/types'
import { DoseEditSheet } from './DoseEditSheet'
import { EffectSheet } from './EffectSheet'
import { NoteSheet } from './NoteSheet'
import type { TimelineItem } from './Timeline'

type Editing =
  | { kind: 'dose'; log: DoseLog }
  | { kind: 'effect'; entry?: EffectEntry }
  | { kind: 'note'; note?: Note; medicationId?: string }
  | null

/** Opens the right edit sheet for timeline items, and new effect/note sheets. */
export function useEntryEditor(medications: Medication[] | undefined) {
  const [editing, setEditing] = useState<Editing>(null)
  const close = () => setEditing(null)

  const edit = (item: TimelineItem) => {
    if (item.kind === 'dose') setEditing({ kind: 'dose', log: item.log })
    else if (item.kind === 'effect') setEditing({ kind: 'effect', entry: item.entry })
    else setEditing({ kind: 'note', note: item.note })
  }

  let sheet: ReactNode = null
  if (editing?.kind === 'dose')
    sheet = (
      <DoseEditSheet log={editing.log} medication={medications?.find((m) => m.id === editing.log.medicationId)} onClose={close} />
    )
  else if (editing?.kind === 'effect') sheet = <EffectSheet entry={editing.entry} onClose={close} />
  else if (editing?.kind === 'note') sheet = <NoteSheet note={editing.note} medicationId={editing.medicationId} onClose={close} />

  return {
    edit,
    editDose: (log: DoseLog) => setEditing({ kind: 'dose', log }),
    newEffect: () => setEditing({ kind: 'effect' }),
    newNote: (medicationId?: string) => setEditing({ kind: 'note', medicationId }),
    sheet,
  }
}
