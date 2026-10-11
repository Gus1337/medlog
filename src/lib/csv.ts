// CSV export of all raw data, one file per kind of record.
import type { CheckIn, DoseChange, DoseLog, EffectEntry, Habit, HabitLog, Medication, Note, Summary, Tag } from '../db/types'
import { formatDuration } from './time'
import { indexDoseLogs, sinceDoseForMedication } from './timeSinceDose'

type Cell = string | number | boolean | null | undefined

/** Quotes when needed, and defuses cells that spreadsheets would run as formulas. */
export function csvCell(value: Cell): string {
  if (value === null || value === undefined) return ''
  let s = String(value)
  if (typeof value === 'string' && /^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n') + '\r\n'
}

/** Local time as "YYYY-MM-DD HH:MM", which spreadsheets read as a date. */
export function csvTime(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())} ${p(d.getHours())}:${p(d.getMinutes())}`
}

export interface AllData {
  medications: Medication[]
  doseChanges: DoseChange[]
  doseLogs: DoseLog[]
  effects: EffectEntry[]
  tags: Tag[]
  notes: Note[]
  checkIns: CheckIn[]
  summaries: Summary[]
  habits: Habit[]
  habitLogs: HabitLog[]
}

export function buildCsvFiles(data: AllData): { name: string; content: string }[] {
  const medName = new Map(data.medications.map((m) => [m.id, m.name]))
  const tagName = new Map(data.tags.map((t) => [t.id, t.name]))
  const habitById = new Map(data.habits.map((h) => [h.id, h]))
  const doseIndex = indexDoseLogs(data.doseLogs)
  const byTime = <T,>(list: T[], key: (x: T) => number) => [...list].sort((a, b) => key(a) - key(b))

  return [
    {
      name: 'medications.csv',
      content: toCsv(
        ['id', 'name', 'dose_amount', 'unit', 'purpose', 'colour', 'usual_times', 'start_date', 'archived'],
        data.medications.map((m) => [m.id, m.name, m.doseAmount, m.unit, m.purpose, m.colour, m.usualTimes.join(' '), csvTime(m.startDate).slice(0, 10), m.isArchived]),
      ),
    },
    {
      name: 'dose_changes.csv',
      content: toCsv(
        ['date', 'medication', 'amount', 'unit'],
        byTime(data.doseChanges, (c) => c.date).map((c) => [csvTime(c.date), medName.get(c.medicationId), c.amount, c.unit]),
      ),
    },
    {
      name: 'doses.csv',
      content: toCsv(
        ['time', 'medication', 'amount', 'unit', 'status'],
        byTime(data.doseLogs, (l) => l.timestamp).map((l) => [csvTime(l.timestamp), medName.get(l.medicationId), l.amount, l.unit, l.status]),
      ),
    },
    {
      name: 'effects.csv',
      content: toCsv(
        ['time', 'text', 'feel', 'strength', 'tags', 'medications', 'time_since_dose'],
        byTime(data.effects, (e) => e.timestamp).map((e) => {
          const meds = e.medicationIds.length ? e.medicationIds : data.medications.map((m) => m.id)
          const since = meds
            .map((id) => {
              const s = sinceDoseForMedication(e.timestamp, doseIndex.get(id))
              return s ? `${formatDuration(s.elapsed)} after ${medName.get(id)}` : null
            })
            .filter(Boolean)
            .join('; ')
          return [
            csvTime(e.timestamp),
            e.text,
            e.feel === 'bad' ? 'unwanted' : e.feel,
            e.strength,
            e.tagIds.map((id) => tagName.get(id)).filter(Boolean).join('; '),
            e.medicationIds.length ? e.medicationIds.map((id) => medName.get(id)).join('; ') : 'not sure',
            since,
          ]
        }),
      ),
    },
    {
      name: 'notes.csv',
      content: toCsv(
        ['time', 'about', 'text'],
        byTime(data.notes, (n) => n.createdAt).map((n) => [csvTime(n.createdAt), n.medicationId ? medName.get(n.medicationId) : 'day', n.text]),
      ),
    },
    {
      name: 'check_ins.csv',
      content: toCsv(
        ['date', 'focus', 'anxiety', 'mood', 'sleep'],
        [...data.checkIns].sort((a, b) => a.date.localeCompare(b.date)).map((c) => [c.date, c.focus, c.anxiety, c.mood, c.sleep]),
      ),
    },
    {
      name: 'summaries.csv',
      content: toCsv(
        ['written', 'period_start', 'period_end', 'scope', 'entries', 'text'],
        byTime(data.summaries, (s) => s.createdAt).map((s) => [
          csvTime(s.createdAt),
          csvTime(s.periodStart).slice(0, 10),
          csvTime(s.periodEnd - 1).slice(0, 10),
          s.scope === 'overall' ? 'overall' : medName.get(s.scope),
          s.entryCount,
          s.text,
        ]),
      ),
    },
    {
      name: 'habits.csv',
      content: toCsv(
        ['name', 'kind', 'unit', 'daily_target', 'days_per_week_target', 'added', 'archived'],
        byTime(data.habits, (h) => h.createdAt).map((h) => [
          h.name,
          h.kind === 'check' ? 'done/not done' : 'amount',
          h.unit,
          h.dailyTarget,
          h.weeklyTarget,
          csvTime(h.createdAt).slice(0, 10),
          h.isArchived,
        ]),
      ),
    },
    {
      name: 'habit_log.csv',
      content: toCsv(
        ['date', 'habit', 'value', 'unit', 'on_target'],
        [...data.habitLogs]
          .sort((a, b) => a.date.localeCompare(b.date))
          .map((l) => {
            const h = habitById.get(l.habitId)
            return [l.date, h?.name, l.value, h?.unit, h ? l.value >= h.dailyTarget : undefined]
          }),
      ),
    },
  ]
}
