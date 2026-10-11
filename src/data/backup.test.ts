import 'fake-indexeddb/auto'
import { beforeEach, describe, expect, it } from 'vitest'
import { db, setSetting } from '../db/db'
import { generateSampleData, loadSampleData } from '../dev/sampleData'
import { BackupError, createBackup, deleteAllData, restoreBackup, validateBackup } from './backup'

describe('backup', () => {
  beforeEach(async () => {
    await deleteAllData()
    await loadSampleData()
  })

  it('round-trips everything through JSON', async () => {
    await setSetting('claudeApiKey', 'sk-ant-secret')
    const before = await createBackup()
    const json = JSON.stringify(before)
    expect(json).not.toContain('sk-ant-secret')

    await deleteAllData()
    expect(await db.effects.count()).toBe(0)

    await restoreBackup(validateBackup(JSON.parse(json)))
    const after = await createBackup()
    expect(after.data).toEqual(before.data)
  })

  it('rejects files that are not MedLog backups', () => {
    expect(() => validateBackup({ hello: 1 })).toThrow(BackupError)
    expect(() => validateBackup({ app: 'medlog', version: 99, data: {} })).toThrow(/newer version/)
    expect(() => validateBackup({ app: 'medlog', version: 1, data: { effects: [{ nope: true }] } })).toThrow(/damaged/)
  })

  it('rejects doses that point at missing medications', () => {
    const s = generateSampleData()
    const data = { ...s, medications: [], summaries: [] }
    expect(() => validateBackup({ app: 'medlog', version: 1, exportedAt: '', data })).toThrow(/without a medication/)
  })

  it('deletes all data and settings', async () => {
    await setSetting('pinHash', { salt: 'x', hash: 'y', iterations: 1, length: 4 })
    await deleteAllData()
    expect(await db.medications.count()).toBe(0)
    expect(await db.settings.count()).toBe(0)
  })
})
