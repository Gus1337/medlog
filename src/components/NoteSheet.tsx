import { useState } from 'react'
import { deleteNote, restoreNote, saveNote } from '../data/entries'
import { useMedications } from '../data/hooks'
import type { Note } from '../db/types'
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/time'
import { medColour } from '../ui/colours'
import { useFeedback } from '../ui/feedback'
import { Button, Chip, Field, inputClass } from '../ui/primitives'
import { Sheet, useCloseSheet } from '../ui/Sheet'

/** Longer notes: a day note (no medication) or a note about one medication. */
export function NoteSheet({
  note,
  medicationId,
  onClose,
}: {
  note?: Note
  /** Preselected medication for a new note. */
  medicationId?: string
  onClose: () => void
}) {
  const meds = useMedications()
  const [text, setText] = useState(note?.text ?? '')
  const [medId, setMedId] = useState<string | undefined>(note ? note.medicationId : medicationId)
  const [at, setAt] = useState(toDateTimeLocal(note?.createdAt ?? Date.now()))

  return (
    <Sheet
      title={note ? 'Edit note' : 'New note'}
      onClose={onClose}
      actionLabel="Save"
      actionDisabled={!text.trim()}
      onAction={() => saveNote({ id: note?.id, text: text.trim(), medicationId: medId, createdAt: fromDateTimeLocal(at) })}
    >
      <div className="space-y-6 pt-1">
        <textarea
          className={`${inputClass} min-h-48 resize-none leading-snug`}
          placeholder="Write as much as you like."
          value={text}
          onChange={(e) => setText(e.target.value)}
          autoFocus={!note}
        />
        <div>
          <p className="mb-2 text-[15px] text-muted">About</p>
          <div className="flex flex-wrap gap-2">
            <Chip selected={!medId} onClick={() => setMedId(undefined)}>
              The day
            </Chip>
            {(meds ?? [])
              .filter((m) => !m.isArchived || m.id === medId)
              .map((m) => (
                <Chip key={m.id} selected={medId === m.id} colour={medColour(m.colour)} onClick={() => setMedId(m.id)}>
                  {m.name}
                </Chip>
              ))}
          </div>
        </div>
        <Field label="Date and time">
          <input className={inputClass} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        {note && <DeleteNote note={note} />}
      </div>
    </Sheet>
  )
}

function DeleteNote({ note }: { note: Note }) {
  const close = useCloseSheet()
  const { toast } = useFeedback()
  return (
    <Button
      variant="quiet-danger"
      className="w-full"
      onClick={async () => {
        await deleteNote(note.id)
        close()
        toast('Note removed', { label: 'Undo', onClick: () => restoreNote(note) })
      }}
    >
      Remove this note
    </Button>
  )
}
