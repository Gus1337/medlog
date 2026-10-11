import { useState } from 'react'
import { HABIT_PERIODS, HabitAmountChart, HabitDaysChart, periodRange, type HabitPeriod } from '../components/charts/HabitCharts'
import { HabitAmountSheet } from '../components/HabitAmountSheet'
import { HabitForm } from '../components/HabitForm'
import { deleteHabit, setHabitArchived, setHabitValue, useHabitLogs, useHabits } from '../data/habits'
import type { Habit, HabitLog } from '../db/types'
import { describeTarget, eachDay, formatAmount, onTarget, periodStats, valuesByDay, weekProgress } from '../lib/habits'
import { addDays, dayKey, startOfDay } from '../lib/time'
import { useNow } from '../lib/useNow'
import { goBack } from '../router'
import { habitColour } from '../ui/colours'
import { useFeedback } from '../ui/feedback'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, Card, EmptyState, Segmented, SectionTitle } from '../ui/primitives'

export function HabitDetailScreen({ id }: { id: string }) {
  const now = useNow()
  const habits = useHabits()
  const habit = habits?.find((h) => h.id === id)
  const [period, setPeriod] = useState<HabitPeriod>('4w')
  const { from, to } = periodRange(period, now)
  const logs = useHabitLogs(dayKey(addDays(Math.min(from, addDays(startOfDay(now), -13)), -6)), dayKey(now))
  const [editing, setEditing] = useState(false)
  const { confirm, toast } = useFeedback()

  if (!habits || !logs) return null
  if (!habit) {
    return (
      <>
        <ScreenHeader title="Not found" onBack={() => goBack({ name: 'habits' })} />
        <Page>
          <EmptyState title="This habit no longer exists" />
        </Page>
      </>
    )
  }

  const own = logs.filter((l) => l.habitId === habit.id)
  const week = weekProgress(habit, own, now)
  const stats = periodStats(habit, own, from, to, now)
  const periodLabel = HABIT_PERIODS.find((p) => p.value === period)!.label.toLowerCase()

  const toggleArchive = async () => {
    if (!habit.isArchived) {
      const ok = await confirm({
        title: `Archive ${habit.name}?`,
        message: 'It disappears from Today but everything you logged stays. You can restore it at any time.',
        confirmLabel: 'Archive',
      })
      if (!ok) return
    }
    await setHabitArchived(habit.id, !habit.isArchived)
    toast(habit.isArchived ? 'Restored' : 'Archived')
  }

  const remove = async () => {
    const ok = await confirm({
      title: `Delete ${habit.name}?`,
      message: 'This deletes the habit and every day logged for it. Archive it instead if you want to keep the history.',
      confirmLabel: 'Delete habit',
    })
    if (!ok) return
    await deleteHabit(habit.id)
    toast('Habit deleted')
    goBack({ name: 'habits' })
  }

  return (
    <>
      <ScreenHeader title={habit.name} subtitle={describeTarget(habit)} onBack={() => goBack({ name: 'habits' })} />
      <Page>
        <Card>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-[15px] text-muted">This week</p>
              <p className="text-xl font-semibold">
                {week.done} of {week.target} days
              </p>
            </div>
            <div>
              <p className="text-[15px] text-muted">Last {periodLabel}</p>
              <p className="text-xl font-semibold">
                {stats.daysOnTarget} of {stats.days} days
              </p>
            </div>
            {habit.kind === 'amount' && stats.averagePerLoggedDay !== null && (
              <div className="col-span-2">
                <p className="text-[15px] text-muted">Average on logged days, last {periodLabel}</p>
                <p className="text-xl font-semibold">{formatAmount(habit, Math.round(stats.averagePerLoggedDay))}</p>
              </div>
            )}
          </div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <Button icon="edit" onClick={() => setEditing(true)}>
              Edit
            </Button>
            <Button onClick={toggleArchive}>{habit.isArchived ? 'Restore' : 'Archive'}</Button>
          </div>
        </Card>

        <SectionTitle>Last 14 days</SectionTitle>
        <DayGrid habit={habit} logs={own} now={now} />

        <SectionTitle>Progress</SectionTitle>
        <div className="space-y-4">
          <Segmented value={period} onChange={setPeriod} options={HABIT_PERIODS} />
          <HabitDaysChart habit={habit} logs={own} from={from} to={to} now={now} />
          {habit.kind === 'amount' && <HabitAmountChart habit={habit} logs={own} from={from} to={to} />}
        </div>

        <Button variant="quiet-danger" className="mt-8 w-full" onClick={remove}>
          Delete habit
        </Button>
      </Page>
      {editing && <HabitForm habit={habit} onClose={() => setEditing(false)} />}
    </>
  )
}

/** Two weeks of days to fill in or correct, oldest first. */
function DayGrid({ habit, logs, now }: { habit: Habit; logs: HabitLog[]; now: number }) {
  const today = startOfDay(now)
  const days = eachDay(addDays(today, -13), addDays(today, 1))
  const values = valuesByDay(habit, logs)
  const colour = habitColour(habit.colour)
  const [amountFor, setAmountFor] = useState<string | null>(null)

  return (
    <section className="rounded-3xl bg-surface p-3">
      <ol className="grid grid-cols-7 gap-1.5">
        {days.map((ts) => {
          const key = dayKey(ts)
          const value = values.get(key)
          const done = onTarget(habit, value)
          const partial = !done && value !== undefined
          const date = new Date(ts)
          const label = date.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
          return (
            <li key={key}>
              <button
                type="button"
                aria-pressed={habit.kind === 'check' ? done : undefined}
                aria-label={`${label}: ${value === undefined ? 'not logged' : formatAmount(habit, value)}`}
                onClick={() => (habit.kind === 'check' ? setHabitValue(habit.id, key, done ? 0 : 1) : setAmountFor(key))}
                className={`flex min-h-14 w-full flex-col items-center justify-center rounded-2xl border-2 text-[13px] transition-colors duration-300 ${
                  ts === today ? 'font-semibold' : ''
                }`}
                style={
                  done
                    ? { backgroundColor: colour, borderColor: colour, color: 'var(--accent-ink)' }
                    : partial
                      ? { borderColor: colour }
                      : { borderColor: 'transparent', backgroundColor: 'var(--surface-2)' }
                }
              >
                <span className={done ? '' : 'text-muted'}>{date.toLocaleDateString(undefined, { weekday: 'narrow' })}</span>
                <span>{date.getDate()}</span>
              </button>
            </li>
          )
        })}
      </ol>
      <p className="mt-2 px-1 text-[13px] text-faint">
        {habit.kind === 'check' ? 'Tap a day to mark it done, or tap again to undo.' : 'Tap a day to log or change its amount. An outline means logged but under the target.'}
      </p>
      {amountFor && (
        <HabitAmountSheet habit={habit} date={amountFor} current={values.get(amountFor)} onClose={() => setAmountFor(null)} />
      )}
    </section>
  )
}
