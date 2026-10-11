import { useState } from 'react'
import { HABIT_PERIODS, HabitProgressChart, periodRange, type HabitPeriod } from '../components/charts/HabitCharts'
import { HabitForm } from '../components/HabitForm'
import { useHabitLogs, useHabits } from '../data/habits'
import type { Habit, HabitLog } from '../db/types'
import { describeTarget, periodStats, weekProgress } from '../lib/habits'
import { addDays, dayKey } from '../lib/time'
import { useNow } from '../lib/useNow'
import { goBack, navigate } from '../router'
import { habitColour } from '../ui/colours'
import { Icon } from '../ui/Icon'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, EmptyState, Segmented, SectionTitle } from '../ui/primitives'

export function HabitsScreen() {
  const now = useNow()
  const habits = useHabits()
  const [period, setPeriod] = useState<HabitPeriod>('4w')
  const { from, to } = periodRange(period, now)
  // Six extra days so the first point of each line has a full week behind it.
  const logs = useHabitLogs(dayKey(addDays(from, -6)), dayKey(now))
  const [adding, setAdding] = useState(false)
  const [showArchived, setShowArchived] = useState(false)

  if (!habits || !logs) return null
  const active = habits.filter((h) => !h.isArchived)
  const archived = habits.filter((h) => h.isArchived)

  return (
    <>
      <ScreenHeader title="Habits" onBack={() => goBack({ name: 'today' })} />
      <Page>
        {active.length === 0 ? (
          <EmptyState icon="target" title="No habits yet">
            Add a habit, such as reading, a workout or 10K steps. A line for each will show your progress against the
            weekly target you set.
          </EmptyState>
        ) : (
          <div className="space-y-4">
            <Segmented value={period} onChange={setPeriod} options={HABIT_PERIODS} />
            <HabitProgressChart habits={active} logs={logs} from={from} to={to} now={now} />
            <ul className="space-y-3">
              {active.map((h) => (
                <HabitRow key={h.id} habit={h} logs={logs} from={from} to={to} now={now} periodLabel={HABIT_PERIODS.find((p) => p.value === period)!.label} />
              ))}
            </ul>
          </div>
        )}

        <Button variant="primary" icon="plus" className="mt-5 w-full" onClick={() => setAdding(true)}>
          Add habit
        </Button>

        {archived.length > 0 && (
          <>
            <SectionTitle
              action={
                <Button variant="ghost" onClick={() => setShowArchived(!showArchived)}>
                  {showArchived ? 'Hide' : `Show ${archived.length}`}
                </Button>
              }
            >
              Archived
            </SectionTitle>
            {showArchived && (
              <ul className="space-y-3">
                {archived.map((h) => (
                  <li key={h.id}>
                    <button
                      type="button"
                      onClick={() => navigate({ name: 'habit', id: h.id })}
                      className="flex min-h-14 w-full items-center justify-between rounded-3xl bg-surface px-5 text-left text-muted"
                    >
                      {h.name}
                      <Icon name="chevron" size={18} className="text-faint" />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </Page>
      {adding && <HabitForm onClose={() => setAdding(false)} />}
    </>
  )
}

function HabitRow({
  habit,
  logs,
  from,
  to,
  now,
  periodLabel,
}: {
  habit: Habit
  logs: HabitLog[]
  from: number
  to: number
  now: number
  periodLabel: string
}) {
  const week = weekProgress(habit, logs, now)
  const stats = periodStats(habit, logs, from, to, now)
  return (
    <li>
      <button
        type="button"
        onClick={() => navigate({ name: 'habit', id: habit.id })}
        className="flex w-full items-center gap-4 rounded-3xl bg-surface p-5 text-left"
      >
        <span className="h-10 w-1 shrink-0 rounded-full" style={{ backgroundColor: habitColour(habit.colour) }} />
        <span className="min-w-0 flex-1">
          <span className="block truncate text-lg font-semibold">{habit.name}</span>
          <span className="block text-[15px] text-muted">{describeTarget(habit)}</span>
          <span className="mt-1 block text-[15px]">
            This week {week.done} of {week.target}
            <span className="text-muted">
              {' '}
              · {periodLabel.toLowerCase()}: {stats.daysOnTarget} of {stats.days} days
            </span>
          </span>
        </span>
        <Icon name="chevron" size={18} className="text-faint" />
      </button>
    </li>
  )
}
