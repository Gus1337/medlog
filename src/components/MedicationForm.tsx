import { useState } from 'react'
import { addMedication, updateMedication } from '../data/medications'
import { PALETTE_KEYS, type Medication, type PaletteKey } from '../db/types'
import { dayKey, dayKeyToTs, fromDateTimeLocal, toDateTimeLocal } from '../lib/time'
import { medColour, PALETTE_LABELS } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { Button, Field, inputClass } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

const UNITS = ['mg', 'mcg', 'g', 'ml', 'tablet', 'capsule', 'drops', 'puffs', 'IU']

/** Add or edit a medication. Changing the dose records a DoseChange. */
export function MedicationForm({
  medication,
  onClose,
  onSaved,
  usedColours = [],
}: {
  medication?: Medication
  onClose: () => void
  onSaved?: (id: string) => void
  usedColours?: PaletteKey[]
}) {
  const editing = !!medication
  const [name, setName] = useState(medication?.name ?? '')
  const [amount, setAmount] = useState(medication ? String(medication.doseAmount) : '')
  const [unit, setUnit] = useState(medication?.unit ?? 'mg')
  const [purpose, setPurpose] = useState(medication?.purpose ?? '')
  const [colour, setColour] = useState<PaletteKey>(
    medication?.colour ?? PALETTE_KEYS.find((k) => !usedColours.includes(k)) ?? 'sage',
  )
  const [times, setTimes] = useState<string[]>(medication?.usualTimes ?? ['08:00'])
  const [startDate, setStartDate] = useState(dayKey(medication?.startDate ?? Date.now()))
  const [changeAt, setChangeAt] = useState(toDateTimeLocal(Date.now()))

  const parsedAmount = Number(amount.replace(',', '.'))
  const valid = name.trim().length > 0 && parsedAmount > 0 && unit.trim().length > 0
  const doseChanged = editing && (parsedAmount !== medication.doseAmount || unit.trim() !== medication.unit)

  const save = async () => {
    const input = {
      name: name.trim(),
      doseAmount: parsedAmount,
      unit: unit.trim(),
      purpose: purpose.trim(),
      colour,
      usualTimes: [...new Set(times.filter(Boolean))].sort(),
      startDate: dayKeyToTs(startDate),
    }
    if (editing) {
      await updateMedication(medication.id, input, fromDateTimeLocal(changeAt))
      onSaved?.(medication.id)
    } else {
      const id = await addMedication(input)
      onSaved?.(id)
    }
  }

  return (
    <Sheet
      title={editing ? 'Edit medication' : 'New medication'}
      onClose={onClose}
      actionLabel="Save"
      onAction={save}
      actionDisabled={!valid}
    >
      <div className="space-y-5 pt-2">
        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} autoFocus={!editing} />
        </Field>

        <div className="grid grid-cols-[1fr_8rem] gap-3">
          <Field label="Usual dose">
            <input className={inputClass} inputMode="decimal" value={amount} onChange={(e) => setAmount(e.target.value)} />
          </Field>
          <Field label="Unit">
            <input className={inputClass} list="units" value={unit} onChange={(e) => setUnit(e.target.value)} />
            <datalist id="units">
              {UNITS.map((u) => (
                <option key={u} value={u} />
              ))}
            </datalist>
          </Field>
        </div>

        {doseChanged && (
          <Field label="New dose from" hint="Saved in the dose history so graphs can show the change.">
            <input className={inputClass} type="datetime-local" value={changeAt} onChange={(e) => setChangeAt(e.target.value)} />
          </Field>
        )}

        <Field label="What it’s for">
          <input className={inputClass} value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="e.g. Focus" />
        </Field>

        <div>
          <span className="mb-1.5 block text-[15px] text-muted">Colour</span>
          <div className="flex flex-wrap gap-3">
            {PALETTE_KEYS.map((k) => (
              <button
                key={k}
                type="button"
                aria-label={PALETTE_LABELS[k]}
                aria-pressed={colour === k}
                onClick={() => setColour(k)}
                className={`flex h-11 w-11 items-center justify-center rounded-full transition-transform duration-300 ${
                  colour === k ? 'scale-110 ring-2 ring-ink/30 ring-offset-2 ring-offset-bg' : ''
                }`}
                style={{ backgroundColor: medColour(k) }}
              >
                {colour === k && <Icon name="check" size={20} className="text-white" />}
              </button>
            ))}
          </div>
        </div>

        <div>
          <span className="mb-1.5 block text-[15px] text-muted">Usual times of day</span>
          <div className="space-y-2">
            {times.map((t, i) => (
              <div key={i} className="flex gap-2">
                <input
                  className={inputClass}
                  type="time"
                  value={t}
                  onChange={(e) => setTimes(times.map((x, j) => (j === i ? e.target.value : x)))}
                />
                <Button aria-label="Remove time" onClick={() => setTimes(times.filter((_, j) => j !== i))}>
                  <Icon name="close" size={18} />
                </Button>
              </div>
            ))}
            <Button variant="ghost" icon="plus" className="-ml-2" onClick={() => setTimes([...times, '20:00'])}>
              Add a time
            </Button>
          </div>
        </div>

        <Field label="Started on">
          <input className={inputClass} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  )
}
