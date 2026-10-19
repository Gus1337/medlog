import { db, newId } from '../db/db'
import type { DoseLog, DoseStatus, Medication } from '../db/types'

export type MedicationInput = Omit<Medication, 'id' | 'isArchived'>

export async function addMedication(input: MedicationInput): Promise<string> {
  const id = newId()
  await db.transaction('rw', db.medications, db.doseChanges, async () => {
    await db.medications.add({ ...input, id, isArchived: false })
    // The starting dose is the first entry in the dose history.
    await db.doseChanges.add({ id: newId(), medicationId: id, date: input.startDate, amount: input.doseAmount, unit: input.unit })
  })
  return id
}

/** Updates a medication and records a DoseChange when the dose or unit changes. */
export async function updateMedication(id: string, changes: Partial<MedicationInput>, changeDate = Date.now()) {
  await db.transaction('rw', db.medications, db.doseChanges, async () => {
    const before = await db.medications.get(id)
    if (!before) return
    await db.medications.update(id, changes)
    const after = { ...before, ...changes }
    if (after.doseAmount !== before.doseAmount || after.unit !== before.unit) {
      await db.doseChanges.add({ id: newId(), medicationId: id, date: changeDate, amount: after.doseAmount, unit: after.unit })
    }
  })
}

export async function setArchived(id: string, isArchived: boolean) {
  await db.medications.update(id, { isArchived })
}

/** Logs a dose with the amount picked at the time. Skipped doses keep the usual amount. Returns the new log's id. */
export async function logDose(med: Medication, status: DoseStatus, amount = med.doseAmount, timestamp = Date.now()): Promise<string> {
  const id = newId()
  await db.doseLogs.add({ id, medicationId: med.id, timestamp, amount, unit: med.unit, status })
  return id
}

export async function updateDoseLog(id: string, changes: Partial<Omit<DoseLog, 'id' | 'medicationId'>>) {
  await db.doseLogs.update(id, changes)
}

export async function deleteDoseLog(id: string) {
  await db.doseLogs.delete(id)
}

/** Restores a deleted dose log (used by Undo). */
export async function restoreDoseLog(log: DoseLog) {
  await db.doseLogs.put(log)
}
