import Dexie, { type EntityTable } from 'dexie'
import type {
  CheckIn,
  DoseChange,
  DoseLog,
  EffectEntry,
  Habit,
  HabitLog,
  Medication,
  Note,
  Setting,
  Summary,
  Tag,
} from './types'

export class MedLogDB extends Dexie {
  medications!: EntityTable<Medication, 'id'>
  doseChanges!: EntityTable<DoseChange, 'id'>
  doseLogs!: EntityTable<DoseLog, 'id'>
  effects!: EntityTable<EffectEntry, 'id'>
  tags!: EntityTable<Tag, 'id'>
  notes!: EntityTable<Note, 'id'>
  checkIns!: EntityTable<CheckIn, 'id'>
  summaries!: EntityTable<Summary, 'id'>
  habits!: EntityTable<Habit, 'id'>
  habitLogs!: EntityTable<HabitLog, 'id'>
  settings!: EntityTable<Setting, 'key'>

  constructor(name = 'medlog') {
    super(name)
    this.version(1).stores({
      medications: 'id, name',
      doseChanges: 'id, medicationId, date',
      doseLogs: 'id, medicationId, timestamp',
      effects: 'id, timestamp, *tagIds, *medicationIds',
      tags: 'id, &name',
      notes: 'id, createdAt, medicationId',
      checkIns: 'id, &date',
      summaries: 'id, createdAt, scope',
      settings: 'key',
    })
    this.version(2).stores({
      habits: 'id, createdAt',
      habitLogs: 'id, habitId, date, &[habitId+date]',
    })
  }
}

export const db = new MedLogDB()

/** Tables that hold the user's data (everything except settings). */
export const DATA_TABLES = [
  'medications',
  'doseChanges',
  'doseLogs',
  'effects',
  'tags',
  'notes',
  'checkIns',
  'summaries',
  'habits',
  'habitLogs',
] as const
export type DataTable = (typeof DATA_TABLES)[number]

export const newId = () => crypto.randomUUID()

export async function getSetting<T>(key: string): Promise<T | undefined> {
  return (await db.settings.get(key))?.value as T | undefined
}

export async function setSetting(key: string, value: unknown) {
  await db.settings.put({ key, value })
}

export async function deleteSetting(key: string) {
  await db.settings.delete(key)
}
