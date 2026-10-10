import type { DoseLog, EffectEntry, Medication } from '../db/types'
import { DAY, formatDuration } from './time'

export interface SinceDose {
  medicationId: string
  doseLogId: string
  doseTimestamp: number
  /** Milliseconds from the dose to the moment in question (>= 0). */
  elapsed: number
}

/**
 * For a moment in time, finds the most recent *taken* dose of each medication
 * within the previous 24 hours (inclusive). Doses after the moment, skipped
 * doses and older doses are ignored. Results are ordered by elapsed time,
 * most recent dose first.
 */
export function timeSinceDose(at: number, doseLogs: readonly DoseLog[]): SinceDose[] {
  const latest = new Map<string, DoseLog>()
  for (const log of doseLogs) {
    if (log.status !== 'taken') continue
    if (log.timestamp > at || at - log.timestamp > DAY) continue
    const current = latest.get(log.medicationId)
    if (!current || log.timestamp > current.timestamp) latest.set(log.medicationId, log)
  }
  return [...latest.values()]
    .map((log) => ({
      medicationId: log.medicationId,
      doseLogId: log.id,
      doseTimestamp: log.timestamp,
      elapsed: at - log.timestamp,
    }))
    .sort((a, b) => a.elapsed - b.elapsed)
}

/**
 * Time since dose for an effect entry. If the entry is linked to medications,
 * only those are reported; for "not sure" entries every medication with a
 * recent dose is reported.
 */
export function timeSinceDoseForEffect(entry: EffectEntry, doseLogs: readonly DoseLog[]): SinceDose[] {
  const all = timeSinceDose(entry.timestamp, doseLogs)
  if (entry.medicationIds.length === 0) return all
  return all.filter((s) => entry.medicationIds.includes(s.medicationId))
}

/** "2h 10m after Sertraline". */
export function describeSinceDose(s: SinceDose, medications: readonly Medication[]): string {
  const name = medications.find((m) => m.id === s.medicationId)?.name ?? 'a medication'
  return `${formatDuration(s.elapsed)} after ${name}`
}

/**
 * Builds a fast lookup for many effects at once: dose logs grouped by
 * medication and sorted by time. Use with `timeSinceDoseIndexed`.
 */
export function indexDoseLogs(doseLogs: readonly DoseLog[]): Map<string, DoseLog[]> {
  const byMed = new Map<string, DoseLog[]>()
  for (const log of doseLogs) {
    if (log.status !== 'taken') continue
    const list = byMed.get(log.medicationId) ?? []
    list.push(log)
    byMed.set(log.medicationId, list)
  }
  for (const list of byMed.values()) list.sort((a, b) => a.timestamp - b.timestamp)
  return byMed
}

/** Same result as `timeSinceDose` for one medication, via binary search. */
export function sinceDoseForMedication(at: number, sortedTaken: readonly DoseLog[] | undefined): SinceDose | undefined {
  if (!sortedTaken || sortedTaken.length === 0) return undefined
  let lo = 0
  let hi = sortedTaken.length - 1
  let found = -1
  while (lo <= hi) {
    const mid = (lo + hi) >> 1
    if (sortedTaken[mid].timestamp <= at) {
      found = mid
      lo = mid + 1
    } else hi = mid - 1
  }
  if (found < 0) return undefined
  const log = sortedTaken[found]
  if (at - log.timestamp > DAY) return undefined
  return { medicationId: log.medicationId, doseLogId: log.id, doseTimestamp: log.timestamp, elapsed: at - log.timestamp }
}
