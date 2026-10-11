import { useState } from 'react'
import { addHabit, updateHabit, type HabitInput } from '../data/habits'
import type { Habit, HabitKind } from '../db/types'
import { parseAmount } from '../lib/habits'
import { Chip, Field, inputClass, Segmented } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

const UNITS = ['steps', 'min', 'pages', 'km', 'glasses', 'times']

const PRESETS: (HabitInput & { label: string })[] = [
  { label: 'Read', name: 'Read', kind: 'check', unit: '', dailyTarget: 1, weeklyTarget: 5 },
  { label: 'Workout', name: 'Workout', kind: 'check', unit: '', dailyTarget: 1, weeklyTarget: 3 },
  { label: '10K steps', name: 'Steps', kind: 'amount', unit: 'steps', dailyTarget: 10000, weeklyTarget: 5 },
  { label: 'Meditate', name: 'Meditate', kind: 'amount', unit: 'min', dailyTarget: 10, weeklyTarget: 7 },
  { label: 'Water', name: 'Water', kind: 'amount', unit: 'glasses', dailyTarget: 8, weeklyTarget: 7 },
]

/** Add or edit a habit and its targets. */
export function HabitForm({ habit, onClose, onSaved }: { habit?: Habit; onClose: () => void; onSaved?: (id: string) => void }) {
  const [name, setName] = useState(habit?.name ?? '')
  const [kind, setKind] = useState<HabitKind>(habit?.kind ?? 'check')
  const [unit, setUnit] = useState(habit?.unit ?? '')
  const [daily, setDaily] = useState(habit && habit.kind === 'amount' ? String(habit.dailyTarget) : '')
  const [weekly, setWeekly] = useState(String(habit?.weeklyTarget ?? 5))

  const parsedDaily = parseAmount(daily)
  const valid = name.trim().length > 0 && (kind === 'check' || parsedDaily > 0)

  const usePreset = (p: HabitInput) => {
    setName(p.name)
    setKind(p.kind)
    setUnit(p.unit)
    setDaily(p.kind === 'amount' ? String(p.dailyTarget) : '')
    setWeekly(String(p.weeklyTarget))
  }

  const save = async () => {
    const input: HabitInput = {
      name: name.trim(),
      kind,
      unit: kind === 'amount' ? unit.trim() : '',
      dailyTarget: kind === 'amount' ? parsedDaily : 1,
      weeklyTarget: Number(weekly),
    }
    if (habit) {
      await updateHabit(habit.id, input)
      onSaved?.(habit.id)
    } else {
      onSaved?.(await addHabit(input))
    }
  }

  return (
    <Sheet title={habit ? 'Edit habit' : 'New habit'} onClose={onClose} actionLabel="Save" onAction={save} actionDisabled={!valid}>
      <div className="space-y-5 pt-2">
        {!habit && (
          <div className="flex flex-wrap gap-2">
            {PRESETS.map((p) => (
              <Chip key={p.label} selected={false} onClick={() => usePreset(p)}>
                {p.label}
              </Chip>
            ))}
          </div>
        )}

        <Field label="Name">
          <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Read" autoFocus={!habit} />
        </Field>

        <div>
          <span className="mb-1.5 block text-[15px] text-muted">How you log it</span>
          <Segmented<HabitKind>
            value={kind}
            onChange={setKind}
            options={[
              { value: 'check', label: 'Done / not done' },
              { value: 'amount', label: 'An amount' },
            ]}
          />
        </div>

        {kind === 'amount' && (
          <div className="grid grid-cols-[1fr_8rem] gap-3">
            <Field label="Daily target">
              <input className={inputClass} inputMode="numeric" value={daily} onChange={(e) => setDaily(e.target.value)} placeholder="10000" />
            </Field>
            <Field label="Unit">
              <input className={inputClass} list="habit-units" value={unit} onChange={(e) => setUnit(e.target.value)} placeholder="steps" />
              <datalist id="habit-units">
                {UNITS.map((u) => (
                  <option key={u} value={u} />
                ))}
              </datalist>
            </Field>
          </div>
        )}

        <div>
          <span className="mb-1.5 block text-[15px] text-muted">Days per week you aim for</span>
          <Segmented value={weekly} onChange={setWeekly} options={[1, 2, 3, 4, 5, 6, 7].map((n) => ({ value: String(n), label: String(n) }))} />
          <span className="mt-1 block text-sm text-faint">
            {kind === 'amount' ? 'A day counts when you reach the daily target.' : 'A day counts when you mark it done.'}
          </span>
        </div>
      </div>
    </Sheet>
  )
}
