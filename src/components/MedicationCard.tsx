import { deleteDoseLog, logDose } from '../data/medications'
import type { DoseLog, Medication } from '../db/types'
import { formatTime } from '../lib/time'
import { medColour } from '../ui/colours'
import { useFeedback } from '../ui/feedback'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/primitives'

/** Today card for one medication: one tap on "Taken" logs the usual dose now. */
export function MedicationCard({
  medication,
  todayLogs,
  onEditLog,
}: {
  medication: Medication
  todayLogs: DoseLog[]
  onEditLog: (log: DoseLog) => void
}) {
  const { toast } = useFeedback()
  const expected = Math.max(1, medication.usualTimes.length)
  const done = todayLogs.length >= expected

  const log = async (status: DoseLog['status']) => {
    const id = await logDose(medication, status)
    toast(status === 'taken' ? `${medication.name} taken at ${formatTime(Date.now())}` : `${medication.name} marked as skipped`, {
      label: 'Undo',
      onClick: () => deleteDoseLog(id),
    })
  }

  return (
    <article className="animate-fade rounded-3xl bg-surface p-5">
      <div className="flex items-start gap-3">
        <span className="mt-1.5 h-3 w-3 shrink-0 rounded-full" style={{ backgroundColor: medColour(medication.colour) }} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate text-lg font-semibold">{medication.name}</h3>
          <p className="text-[15px] text-muted">
            {medication.doseAmount} {medication.unit}
            {medication.usualTimes.length > 0 && ` · usually ${medication.usualTimes.join(', ')}`}
          </p>
        </div>
      </div>

      {todayLogs.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {todayLogs.map((l) => (
            <button
              key={l.id}
              type="button"
              onClick={() => onEditLog(l)}
              className="flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[15px]"
              aria-label={`Edit dose at ${formatTime(l.timestamp)}`}
            >
              {l.status === 'taken' ? <Icon name="check" size={16} className="text-accent" /> : <span className="text-faint">–</span>}
              {formatTime(l.timestamp)}
              <span className="text-muted">{l.status === 'taken' ? `${l.amount} ${l.unit}` : 'skipped'}</span>
            </button>
          ))}
        </div>
      )}

      <div className="mt-4 flex gap-2">
        <Button variant={done ? 'soft' : 'primary'} icon="check" className="flex-1" onClick={() => log('taken')}>
          {done ? 'Taken again' : 'Taken'}
        </Button>
        {!done && (
          <Button variant="soft" onClick={() => log('skipped')}>
            Skip
          </Button>
        )}
      </div>
    </article>
  )
}
