import { useState } from 'react'
import { setHabitValue, useHabitLogs, useHabits } from '../data/habits'
import type { Habit, HabitLog } from '../db/types'
import { formatAmount, onTarget, weekProgress } from '../lib/habits'
import { dayKey, startOfWeek } from '../lib/time'
import { navigate } from '../router'
import { habitColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { Button, EmptyState, SectionTitle } from '../ui/primitives'
import { HabitAmountSheet } from './HabitAmountSheet'
import { HabitForm } from './HabitForm'

/** The Habits part of Today: one row per active habit, logged with one tap. */
export function HabitsSection({ now }: { now: number }) {
  const habits = useHabits()
  const today = dayKey(now)
  const logs = useHabitLogs(dayKey(startOfWeek(now)), today)
  const [adding, setAdding] = useState(false)
  const [amountFor, setAmountFor] = useState<Habit | null>(null)

  if (!habits || !logs) return null
  const active = habits.filter((h) => !h.isArchived)

  return (
    <>
      <SectionTitle
        action={
          active.length > 0 && (
            <Button variant="ghost" icon="insights" className="-mr-2 text-[15px]" onClick={() => navigate({ name: 'habits' })}>
              Progress
            </Button>
          )
        }
      >
        Habits
      </SectionTitle>

      {active.length === 0 ? (
        <EmptyState icon="target" title="Track habits here too">
          Reading, a workout, 10K steps: tap once a day to log them, and follow your progress against your own weekly
          target.
          <Button variant="soft" icon="plus" className="mt-4 w-full" onClick={() => setAdding(true)}>
            Add a habit
          </Button>
        </EmptyState>
      ) : (
        <ul className="divide-y divide-line overflow-hidden rounded-3xl bg-surface">
          {active.map((h) => (
            <HabitRow key={h.id} habit={h} logs={logs} now={now} today={today} onAmount={() => setAmountFor(h)} />
          ))}
        </ul>
      )}

      {adding && <HabitForm onClose={() => setAdding(false)} />}
      {amountFor && (
        <HabitAmountSheet
          habit={amountFor}
          date={today}
          current={logs.find((l) => l.habitId === amountFor.id && l.date === today)?.value}
          onClose={() => setAmountFor(null)}
        />
      )}
    </>
  )
}

function HabitRow({
  habit,
  logs,
  now,
  today,
  onAmount,
}: {
  habit: Habit
  logs: HabitLog[]
  now: number
  today: string
  onAmount: () => void
}) {
  const value = logs.find((l) => l.habitId === habit.id && l.date === today)?.value
  const done = onTarget(habit, value)
  const week = weekProgress(habit, logs, now)
  const colour = habitColour(habit.colour)

  return (
    <li className="flex items-center gap-3 py-2 pl-5 pr-3">
      <button
        type="button"
        onClick={() => navigate({ name: 'habit', id: habit.id })}
        className="flex min-h-11 min-w-0 flex-1 items-center gap-3 text-left"
      >
        <span className="h-8 w-1 shrink-0 rounded-full" style={{ backgroundColor: colour }} />
        <span className="min-w-0">
          <span className="block truncate font-medium">{habit.name}</span>
          <span className="block text-[14px] text-muted">
            {week.done} of {week.target} {week.target === 1 ? 'day' : 'days'} this week
          </span>
        </span>
      </button>

      {habit.kind === 'check' ? (
        <button
          type="button"
          aria-pressed={done}
          aria-label={done ? `${habit.name}: done today. Tap to undo.` : `Mark ${habit.name} done today`}
          onClick={() => setHabitValue(habit.id, today, done ? 0 : 1)}
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full border-2 transition-colors duration-300"
          style={done ? { backgroundColor: colour, borderColor: colour } : { borderColor: 'var(--border)' }}
        >
          {done && <Icon name="check" size={22} className="text-accent-ink" />}
        </button>
      ) : (
        <button
          type="button"
          onClick={onAmount}
          aria-label={`Log ${habit.name} for today`}
          className="flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border-2 px-3.5 text-[15px] transition-colors duration-300"
          style={done ? { backgroundColor: colour, borderColor: colour, color: 'var(--accent-ink)' } : { borderColor: 'var(--border)' }}
        >
          {done && <Icon name="check" size={18} />}
          {value !== undefined ? formatAmount(habit, value) : <span className="text-muted">Log</span>}
        </button>
      )}
    </li>
  )
}
