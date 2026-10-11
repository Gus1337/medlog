import { useState } from 'react'
import { deleteDoseLog, restoreDoseLog, updateDoseLog } from '../data/medications'
import type { DoseLog, DoseStatus, Medication } from '../db/types'
import { fromDateTimeLocal, toDateTimeLocal } from '../lib/time'
import { useFeedback } from '../ui/feedback'
import { Button, Field, inputClass, Segmented } from '../ui/primitives'
import { Sheet, useCloseSheet } from '../ui/Sheet'

/** Edit the time, amount or status of a logged dose, or delete it. */
export function DoseEditSheet({ log, medication, onClose }: { log: DoseLog; medication?: Medication; onClose: () => void }) {
  const [at, setAt] = useState(toDateTimeLocal(log.timestamp))
  const [amount, setAmount] = useState(String(log.amount))
  const [status, setStatus] = useState<DoseStatus>(log.status)
  const parsed = Number(amount.replace(',', '.'))

  return (
    <Sheet
      title={medication?.name ?? 'Dose'}
      onClose={onClose}
      actionLabel="Save"
      actionDisabled={!(parsed > 0) || !at}
      onAction={() => updateDoseLog(log.id, { timestamp: fromDateTimeLocal(at), amount: parsed, status })}
    >
      <div className="space-y-5 pt-2">
        <Segmented
          value={status}
          onChange={setStatus}
          options={[
            { value: 'taken', label: 'Taken' },
            { value: 'skipped', label: 'Skipped' },
          ]}
        />
        <Field label="Time">
          <input className={inputClass} type="datetime-local" value={at} onChange={(e) => setAt(e.target.value)} />
        </Field>
        <Field label={`Amount (${log.unit})`}>
          <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
        </Field>
        <DeleteDose log={log} />
      </div>
    </Sheet>
  )
}

function DeleteDose({ log }: { log: DoseLog }) {
  const close = useCloseSheet()
  const { toast } = useFeedback()
  return (
    <Button
      variant="quiet-danger"
      className="w-full"
      onClick={async () => {
        await deleteDoseLog(log.id)
        close()
        toast('Dose removed', { label: 'Undo', onClick: () => restoreDoseLog(log) })
      }}
    >
      Remove this dose
    </Button>
  )
}
