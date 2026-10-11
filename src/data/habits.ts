import { useLiveQuery } from 'dexie-react-hooks'
import { db, newId } from '../db/db'
import { HABIT_SLOTS, type Habit, type HabitLog } from '../db/types'

export type HabitInput = Pick<Habit, 'name' | 'kind' | 'unit' | 'dailyTarget' | 'weeklyTarget'>

/** Adds a habit with the first line colour no active habit uses. */
export async function addHabit(input: HabitInput): Promise<string> {
  const active = await db.habits.filter((h) => !h.isArchived).toArray()
  const used = new Set(active.map((h) => h.colour))
  const free = [...Array(HABIT_SLOTS).keys()].find((i) => !used.has(i))
  const id = newId()
  await db.habits.add({
    id,
    ...input,
    colour: free ?? (await db.habits.count()) % HABIT_SLOTS,
    createdAt: Date.now(),
    isArchived: false,
  })
  return id
}

export const updateHabit = (id: string, changes: Partial<HabitInput>) => db.habits.update(id, changes)

export const setHabitArchived = (id: string, isArchived: boolean) => db.habits.update(id, { isArchived })

/** Deletes a habit and everything logged for it. */
export async function deleteHabit(id: string) {
  await db.transaction('rw', db.habits, db.habitLogs, async () => {
    await db.habitLogs.where('habitId').equals(id).delete()
    await db.habits.delete(id)
  })
}

/** Sets a day's value; 0 or less removes the day's log. */
export async function setHabitValue(habitId: string, date: string, value: number) {
  const existing = await db.habitLogs.where('[habitId+date]').equals([habitId, date]).first()
  if (value <= 0) {
    if (existing) await db.habitLogs.delete(existing.id)
    return
  }
  await db.habitLogs.put({ id: existing?.id ?? newId(), habitId, date, value, updatedAt: Date.now() })
}

/** All habits, active first, then in the order they were added. */
export function useHabits(): Habit[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.habits.orderBy('createdAt').toArray()
    return [...all.filter((h) => !h.isArchived), ...all.filter((h) => h.isArchived)]
  })
}

/** Logs for days from `fromKey` to `toKey` inclusive ("YYYY-MM-DD"). */
export function useHabitLogs(fromKey: string, toKey: string): HabitLog[] | undefined {
  return useLiveQuery(() => db.habitLogs.where('date').between(fromKey, toKey, true, true).toArray(), [fromKey, toKey])
}
