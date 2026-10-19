import { useLiveQuery } from 'dexie-react-hooks'
import { useMemo, useState } from 'react'
import { deleteDoseLog, logDose } from '../data/medications'
import { db } from '../db/db'
import type { Medication } from '../db/types'
import { formatTime } from '../lib/time'
import { useFeedback } from '../ui/feedback'
import { Chip, Field, inputClass } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

const RECENT_LIMIT = 6

/** Logs a taken dose with the amount picked for this time. Recently taken amounts are one tap away. */
export function DoseLogSheet({ medication, onClose }: { medication: Medication; onClose: () => void }) {
  const { toast } = useFeedback()
  const [text, setText] = useState('')
  const amount = Number(text.replace(',', '.'))
  const valid = amount > 0

  const history = useLiveQuery(() => db.doseLogs.where('medicationId').equals(medication.id).toArray(), [medication.id])
  const recent = useMemo(() => {
    const amounts: number[] = []
    // Newest first, so the chips show what was taken most recently.
    for (const l of [...(history ?? [])].sort((a, b) => b.timestamp - a.timestamp)) {
      if (amounts.length === RECENT_LIMIT) break
      if (l.status === 'taken' && !amounts.includes(l.amount)) amounts.push(l.amount)
    }
    return amounts
  }, [history])

  const save = async () => {
    const id = await logDose(medication, 'taken', amount)
    toast(`${medication.name} taken at ${formatTime(Date.now())}`, { label: 'Undo', onClick: () => deleteDoseLog(id) })
  }

  return (
    <Sheet title={medication.name} onClose={onClose} actionLabel="Save" actionDisabled={!valid} onAction={save}>
      <div className="space-y-5 pt-2">
        <Field label={`Dose (${medication.unit})`}>
          <input className={inputClass} inputMode="decimal" value={text} onChange={(e) => setText(e.target.value)} placeholder="0" autoFocus />
        </Field>
        {recent.length > 0 && (
          <div>
            <span className="mb-2 block text-[15px] text-muted">Recent doses</span>
            <div className="flex flex-wrap gap-2">
              {recent.map((a) => (
                <Chip key={a} selected={amount === a} onClick={() => setText(String(a))}>
                  {a} {medication.unit}
                </Chip>
              ))}
            </div>
          </div>
        )}
      </div>
    </Sheet>
  )
}
