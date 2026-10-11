// Turns raw entries into the small set of statistics the summary model sees.
// Everything numeric is computed here so the model only has to describe it.
import type { CheckIn, DoseChange, DoseLog, EffectEntry, Feel, Medication, Note, Tag } from '../../db/types'
import { HOUR, dayKey } from '../time'
import { indexDoseLogs, sinceDoseForMedication } from '../timeSinceDose'

export const MIN_EFFECT_ENTRIES = 5
const MAX_TAGS = 12
const MAX_EFFECT_SAMPLES = 8
const MAX_NOTE_SAMPLES = 4
const SAMPLE_CHARS = 240

export type SummaryScopeInput = { kind: 'overall' } | { kind: 'medication'; medicationId: string }

export interface SummaryData {
  medications: Medication[]
  effects: EffectEntry[]
  doseLogs: DoseLog[]
  doseChanges: DoseChange[]
  checkIns: CheckIn[]
  notes: Note[]
  tags: Tag[]
}

export interface Period {
  start: number
  /** Exclusive. */
  end: number
}

type FeelCounts = Record<Feel, number>

export interface Timing {
  medianHours: number
  p25Hours: number
  p75Hours: number
  n: number
}

export interface SummaryAggregates {
  scope: { kind: 'overall' } | { kind: 'medication'; name: string; currentDose: string; purpose: string }
  period: { from: string; to: string; days: number }
  previousPeriod: { from: string; to: string }
  /** Number of effect entries the summary is based on. */
  entryCount: number
  previousEntryCount: number
  feel: FeelCounts
  previousFeel: FeelCounts
  attribution: {
    /** Overall scope: entries linked to exactly one medication, by name. */
    linkedToOne: Record<string, number>
    linkedToSeveral: number
    notSure: number
    /** Medication scope: "not sure" entries within 12h of a dose of this medication (not counted in entryCount). */
    notSureWithin12hOfDose?: number
  }
  tags: {
    tag: string
    count: number
    feel: FeelCounts
    previousCount: number
    /** Hours after a dose of the single linked medication; null when unknown. */
    typicalTimeAfterDose: Timing | null
  }[]
  timingByMedication: { medication: string; good: Timing | null; bad: Timing | null; all: Timing | null }[]
  averageStrength: number | null
  doses: {
    medication: string
    currentDose: string
    taken: number
    skipped: number
    previousTaken: number
    previousSkipped: number
    doseChanges: { date: string; from: string; to: string }[]
  }[]
  checkIns: {
    count: number
    averages: Record<'focus' | 'anxiety' | 'mood' | 'sleep', number> | null
    previousAverages: Record<'focus' | 'anxiety' | 'mood' | 'sleep', number> | null
  }
  samples: {
    effects: { when: string; feel: Feel; tags: string[]; medications: string[]; hoursAfterDose: number | null; text: string }[]
    notes: { date: string; about: string; text: string }[]
  }
}

const round1 = (x: number) => Math.round(x * 10) / 10
const emptyFeel = (): FeelCounts => ({ good: 0, neutral: 0, bad: 0 })
const inPeriod = (ts: number, p: Period) => ts >= p.start && ts < p.end
const truncate = (s: string, n = SAMPLE_CHARS) => (s.length > n ? `${s.slice(0, n - 1)}…` : s)

export function quantile(sorted: number[], q: number): number {
  if (sorted.length === 0) return NaN
  const pos = (sorted.length - 1) * q
  const lo = Math.floor(pos)
  const hi = Math.ceil(pos)
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo)
}

export function timing(hours: number[]): Timing | null {
  if (hours.length === 0) return null
  const s = [...hours].sort((a, b) => a - b)
  return { medianHours: round1(quantile(s, 0.5)), p25Hours: round1(quantile(s, 0.25)), p75Hours: round1(quantile(s, 0.75)), n: s.length }
}

/** The period of equal length immediately before. */
export const previousPeriod = (p: Period): Period => ({ start: p.start - (p.end - p.start), end: p.start })

export function inScope(e: EffectEntry, scope: SummaryScopeInput) {
  return scope.kind === 'overall' || e.medicationIds.includes(scope.medicationId)
}

/** Effect entries a summary for this scope and period would be based on. */
export function countEntries(effects: readonly EffectEntry[], scope: SummaryScopeInput, period: Period) {
  return effects.filter((e) => inPeriod(e.timestamp, period) && inScope(e, scope)).length
}

export function buildAggregates(data: SummaryData, scope: SummaryScopeInput, period: Period): SummaryAggregates {
  const prev = previousPeriod(period)
  const medById = new Map(data.medications.map((m) => [m.id, m]))
  const tagById = new Map(data.tags.map((t) => [t.id, t.name]))
  const doseIndex = indexDoseLogs(data.doseLogs)
  const doseText = (m: Medication) => `${m.doseAmount} ${m.unit}`

  const current = data.effects.filter((e) => inPeriod(e.timestamp, period) && inScope(e, scope))
  const previous = data.effects.filter((e) => inPeriod(e.timestamp, prev) && inScope(e, scope))

  const countFeel = (list: EffectEntry[]) => {
    const f = emptyFeel()
    for (const e of list) f[e.feel]++
    return f
  }

  /** Hours since the dose of the one medication an entry is linked to (or the scoped medication). */
  const hoursAfterDose = (e: EffectEntry): number | null => {
    const medId = scope.kind === 'medication' ? scope.medicationId : e.medicationIds.length === 1 ? e.medicationIds[0] : null
    if (!medId) return null
    const s = sinceDoseForMedication(e.timestamp, doseIndex.get(medId))
    return s ? s.elapsed / HOUR : null
  }

  // Attribution
  const linkedToOne: Record<string, number> = {}
  let linkedToSeveral = 0
  let notSure = 0
  for (const e of current) {
    if (e.medicationIds.length === 0) notSure++
    else if (e.medicationIds.length > 1) linkedToSeveral++
    else {
      const name = medById.get(e.medicationIds[0])?.name ?? 'unknown'
      linkedToOne[name] = (linkedToOne[name] ?? 0) + 1
    }
  }
  let notSureWithin12hOfDose: number | undefined
  if (scope.kind === 'medication') {
    notSureWithin12hOfDose = data.effects.filter((e) => {
      if (!inPeriod(e.timestamp, period) || e.medicationIds.length > 0) return false
      const s = sinceDoseForMedication(e.timestamp, doseIndex.get(scope.medicationId))
      return !!s && s.elapsed < 12 * HOUR
    }).length
  }

  // Tags
  const tagStats = new Map<string, { count: number; feel: FeelCounts; hours: number[] }>()
  for (const e of current) {
    const names = e.tagIds.map((id) => tagById.get(id)).filter((n): n is string => !!n)
    const h = hoursAfterDose(e)
    for (const name of names.length ? names : ['(untagged)']) {
      const t = tagStats.get(name) ?? { count: 0, feel: emptyFeel(), hours: [] }
      t.count++
      t.feel[e.feel]++
      if (h !== null) t.hours.push(h)
      tagStats.set(name, t)
    }
  }
  const prevTagCounts = new Map<string, number>()
  for (const e of previous) {
    const names = e.tagIds.map((id) => tagById.get(id)).filter((n): n is string => !!n)
    for (const name of names.length ? names : ['(untagged)']) prevTagCounts.set(name, (prevTagCounts.get(name) ?? 0) + 1)
  }
  const tags = [...tagStats.entries()]
    .sort((a, b) => b[1].count - a[1].count || a[0].localeCompare(b[0]))
    .slice(0, MAX_TAGS)
    .map(([tag, t]) => ({ tag, count: t.count, feel: t.feel, previousCount: prevTagCounts.get(tag) ?? 0, typicalTimeAfterDose: timing(t.hours) }))

  // Timing per medication
  const scopedMeds =
    scope.kind === 'medication' ? data.medications.filter((m) => m.id === scope.medicationId) : data.medications.filter((m) => !m.isArchived)
  const timingByMedication = scopedMeds.map((m) => {
    const hours: Record<Feel | 'all', number[]> = { good: [], neutral: [], bad: [], all: [] }
    for (const e of current) {
      const onlyThis = scope.kind === 'medication' || (e.medicationIds.length === 1 && e.medicationIds[0] === m.id)
      if (!onlyThis) continue
      const s = sinceDoseForMedication(e.timestamp, doseIndex.get(m.id))
      if (!s) continue
      hours[e.feel].push(s.elapsed / HOUR)
      hours.all.push(s.elapsed / HOUR)
    }
    return { medication: m.name, good: timing(hours.good), bad: timing(hours.bad), all: timing(hours.all) }
  })

  const strengths = current.map((e) => e.strength).filter((s): s is 1 | 2 | 3 => !!s)

  // Doses
  const doses = scopedMeds.map((m) => {
    const logs = data.doseLogs.filter((l) => l.medicationId === m.id)
    const count = (p: Period, status: DoseLog['status']) => logs.filter((l) => l.status === status && inPeriod(l.timestamp, p)).length
    const changes = data.doseChanges.filter((c) => c.medicationId === m.id).sort((a, b) => a.date - b.date)
    return {
      medication: m.name,
      currentDose: doseText(m),
      taken: count(period, 'taken'),
      skipped: count(period, 'skipped'),
      previousTaken: count(prev, 'taken'),
      previousSkipped: count(prev, 'skipped'),
      doseChanges: changes
        .map((c, i) => ({ c, before: changes[i - 1] }))
        .filter(({ c, before }) => before && inPeriod(c.date, period))
        .map(({ c, before }) => ({ date: dayKey(c.date), from: `${before!.amount} ${before!.unit}`, to: `${c.amount} ${c.unit}` })),
    }
  })

  // Check-ins
  const avg = (list: CheckIn[]) =>
    list.length === 0
      ? null
      : {
          focus: round1(list.reduce((s, c) => s + c.focus, 0) / list.length),
          anxiety: round1(list.reduce((s, c) => s + c.anxiety, 0) / list.length),
          mood: round1(list.reduce((s, c) => s + c.mood, 0) / list.length),
          sleep: round1(list.reduce((s, c) => s + c.sleep, 0) / list.length),
        }
  const keyIn = (key: string, p: Period) => key >= dayKey(p.start) && key < dayKey(p.end)
  const ciNow = data.checkIns.filter((c) => keyIn(c.date, period))
  const ciPrev = data.checkIns.filter((c) => keyIn(c.date, prev))

  // A limited, varied sample of the user's own words: unwanted, good and neutral, newest first.
  const withText = current.filter((e) => e.text.trim()).sort((a, b) => b.timestamp - a.timestamp)
  const picked: EffectEntry[] = []
  for (let i = 0; picked.length < MAX_EFFECT_SAMPLES && i < withText.length; i++) {
    for (const feel of ['bad', 'good', 'neutral'] as Feel[]) {
      const next = withText.filter((e) => e.feel === feel && !picked.includes(e))[0]
      if (next && picked.length < MAX_EFFECT_SAMPLES) picked.push(next)
    }
  }
  const effectSamples = picked
    .sort((a, b) => a.timestamp - b.timestamp)
    .map((e) => {
      const h = hoursAfterDose(e)
      return {
        when: new Date(e.timestamp).toLocaleString('en-GB', { weekday: 'short', hour: '2-digit', minute: '2-digit' }),
        feel: e.feel,
        tags: e.tagIds.map((id) => tagById.get(id)).filter((n): n is string => !!n),
        medications: e.medicationIds.length ? e.medicationIds.map((id) => medById.get(id)?.name ?? 'unknown') : ['not sure'],
        hoursAfterDose: h === null ? null : round1(h),
        text: truncate(e.text.trim()),
      }
    })
  const noteSamples = data.notes
    .filter((n) => inPeriod(n.createdAt, period))
    .filter((n) => scope.kind === 'overall' || !n.medicationId || n.medicationId === scope.medicationId)
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, MAX_NOTE_SAMPLES)
    .map((n) => ({
      date: dayKey(n.createdAt),
      about: n.medicationId ? (medById.get(n.medicationId)?.name ?? 'a medication') : 'the day',
      text: truncate(n.text.trim()),
    }))

  const scopeMed = scope.kind === 'medication' ? medById.get(scope.medicationId) : undefined
  return {
    scope: scopeMed ? { kind: 'medication', name: scopeMed.name, currentDose: doseText(scopeMed), purpose: scopeMed.purpose } : { kind: 'overall' },
    period: { from: dayKey(period.start), to: dayKey(period.end - 1), days: Math.round((period.end - period.start) / (24 * HOUR)) },
    previousPeriod: { from: dayKey(prev.start), to: dayKey(prev.end - 1) },
    entryCount: current.length,
    previousEntryCount: previous.length,
    feel: countFeel(current),
    previousFeel: countFeel(previous),
    attribution: { linkedToOne, linkedToSeveral, notSure, notSureWithin12hOfDose },
    tags,
    timingByMedication,
    averageStrength: strengths.length ? round1(strengths.reduce((s, x) => s + x, 0) / strengths.length) : null,
    doses,
    checkIns: { count: ciNow.length, averages: avg(ciNow), previousAverages: avg(ciPrev) },
    samples: { effects: effectSamples, notes: noteSamples },
  }
}
