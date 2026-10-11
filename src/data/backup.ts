import type { Table } from 'dexie'
import { DATA_TABLES, db, getSetting, setSetting, type DataTable } from '../db/db'
import type { AllData } from '../lib/csv'

export const BACKUP_APP = 'medlog'
export const BACKUP_VERSION = 1
const LAST_BACKUP = 'lastBackupAt'

/** Settings (API key, PIN) are deliberately not part of a backup. */
export interface Backup {
  app: typeof BACKUP_APP
  version: number
  exportedAt: string
  data: AllData
}

export async function readAllData(): Promise<AllData> {
  const entries = await Promise.all(DATA_TABLES.map(async (t) => [t, await db[t].toArray()] as const))
  return Object.fromEntries(entries) as unknown as AllData
}

export async function createBackup(now = new Date()): Promise<Backup> {
  return { app: BACKUP_APP, version: BACKUP_VERSION, exportedAt: now.toISOString(), data: await readAllData() }
}

export const getLastBackupAt = () => getSetting<string>(LAST_BACKUP)
export const markBackedUp = (at = new Date()) => setSetting(LAST_BACKUP, at.toISOString())

export class BackupError extends Error {}

/** Checks that parsed JSON looks like a MedLog backup before anything is replaced. */
export function validateBackup(json: unknown): Backup {
  const b = json as Partial<Backup>
  if (!b || typeof b !== 'object' || b.app !== BACKUP_APP) throw new BackupError('This file is not a MedLog backup.')
  if (typeof b.version !== 'number' || b.version > BACKUP_VERSION)
    throw new BackupError('This backup was made by a newer version of MedLog. Update the app and try again.')
  if (!b.data || typeof b.data !== 'object') throw new BackupError('The backup file is incomplete.')
  for (const table of DATA_TABLES) {
    const rows = (b.data as unknown as Record<string, unknown>)[table]
    if (rows === undefined) continue // older backups may lack a table
    if (!Array.isArray(rows) || !rows.every((r) => r && typeof r === 'object' && typeof (r as { id?: unknown }).id === 'string'))
      throw new BackupError(`The backup file is damaged (${table}).`)
  }
  const ids = new Set((b.data.medications ?? []).map((m) => m.id))
  if ((b.data.doseLogs ?? []).some((l) => !ids.has(l.medicationId))) throw new BackupError('The backup file is damaged (doses without a medication).')
  return b as Backup
}

/** Replaces all data with the backup's contents, in one transaction. */
export async function restoreBackup(backup: Backup) {
  await db.transaction('rw', DATA_TABLES.map((t) => db[t]), async () => {
    for (const t of DATA_TABLES) {
      await db[t].clear()
      const rows = (backup.data as unknown as Record<DataTable, unknown[]>)[t] ?? []
      await (db[t] as unknown as Table<unknown>).bulkAdd(rows)
    }
  })
}

export function summariseBackup(b: Backup) {
  const d = b.data
  return `${d.medications?.length ?? 0} medications, ${d.doseLogs?.length ?? 0} doses, ${d.effects?.length ?? 0} effects, ${
    d.notes?.length ?? 0
  } notes and ${d.checkIns?.length ?? 0} check-ins`
}

/** Deletes every record and every setting (API key, PIN, backup date). */
export async function deleteAllData() {
  await db.transaction('rw', [...DATA_TABLES.map((t) => db[t]), db.settings], async () => {
    for (const t of DATA_TABLES) await db[t].clear()
    await db.settings.clear()
  })
}
