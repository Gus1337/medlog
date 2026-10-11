import { useLiveQuery } from 'dexie-react-hooks'
import { db } from '../db/db'
import type { Medication, Tag } from '../db/types'

const byName = (a: { name: string }, b: { name: string }) => a.name.localeCompare(b.name)

/** All medications, active first then by name. Undefined while loading. */
export function useMedications(): Medication[] | undefined {
  return useLiveQuery(async () => {
    const all = await db.medications.toArray()
    return all.sort((a, b) => Number(a.isArchived) - Number(b.isArchived) || byName(a, b))
  })
}

export function useActiveMedications(): Medication[] | undefined {
  const meds = useMedications()
  return meds?.filter((m) => !m.isArchived)
}

export function useTags(): Tag[] | undefined {
  return useLiveQuery(async () => (await db.tags.toArray()).sort(byName))
}

/** Dose logs with timestamps in [start, end). */
export function useDoseLogs(start: number, end: number) {
  return useLiveQuery(() => db.doseLogs.where('timestamp').between(start, end, true, false).sortBy('timestamp'), [start, end])
}

export function useEffects(start: number, end: number) {
  return useLiveQuery(() => db.effects.where('timestamp').between(start, end, true, false).sortBy('timestamp'), [start, end])
}

export function useNotes(start: number, end: number) {
  return useLiveQuery(() => db.notes.where('createdAt').between(start, end, true, false).sortBy('createdAt'), [start, end])
}
