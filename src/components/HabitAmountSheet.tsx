import { useState } from 'react'
import { setHabitValue } from '../data/habits'
import type { Habit } from '../db/types'
import { formatAmount, parseAmount } from '../lib/habits'
import { dayKeyToTs, formatDay } from '../lib/time'
import { Button, inputClass } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

/** Sets the amount for one day of an amount habit. */
export function HabitAmountSheet({ habit, date, current, onClose }: { habit: Habit; date: string; current?: number; onClose: () => void }) {
  const [text, setText] = useState(current ? String(current) : '')
  const value = text.trim() === '' ? 0 : parseAmount(text)
  const valid = Number.isFinite(value) && value >= 0
  // Small targets (glasses, pages) are usually counted up one at a time.
  const step = habit.dailyTarget <= 20 ? 1 : null

  return (
    <Sheet
      title={habit.name}
      onClose={onClose}
      actionLabel="Save"
      actionDisabled={!valid}
      onAction={() => setHabitValue(habit.id, date, value)}
    >
      <div className="space-y-4 pt-2">
        <p className="text-[15px] text-muted">
          {formatDay(dayKeyToTs(date))} · target {formatAmount(habit, habit.dailyTarget)}
        </p>
        <div className="flex gap-2">
          <input
            className={`${inputClass} text-2xl`}
            inputMode="decimal"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="0"
            aria-label={`Amount${habit.unit ? ` in ${habit.unit}` : ''}`}
            autoFocus
          />
          {habit.unit && <span className="self-center text-muted">{habit.unit}</span>}
        </div>
        <div className="flex flex-wrap gap-2">
          {step && valid && (
            <Button onClick={() => setText(String((value || 0) + step))}>+{step}</Button>
          )}
          <Button onClick={() => setText(String(habit.dailyTarget))}>Reached the target</Button>
          {current !== undefined && (
            <Button variant="quiet-danger" onClick={() => setText('')}>
              Clear
            </Button>
          )}
        </div>
      </div>
    </Sheet>
  )
}
