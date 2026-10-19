import { describe, expect, it } from 'vitest'
import { generateSampleData } from '../../dev/sampleData'
import type { CheckIn, DoseChange, DoseLog, EffectEntry, Feel, Medication, Note, Tag } from '../../db/types'
import { DAY, HOUR } from '../time'
import { buildAggregates, buildOverview, countEntries, monthsIn, overviewFigures, previousPeriod, quantile, timing, type SummaryData } from './aggregate'
import { buildUserMessage, notEnoughDataText, OVERVIEW_HEADINGS, OVERVIEW_SYSTEM_PROMPT, SUMMARY_HEADINGS, SYSTEM_PROMPT } from './prompt'

const START = new Date(2026, 9, 5).getTime() // Monday
const period = { start: START, end: START + 7 * DAY }

const med = (id: string, name: string): Medication => ({
  id,
  name,
  doseAmount: 10,
  unit: 'mg',
  purpose: '',
  colour: 'sage',
  usualTimes: ['08:00'],
  startDate: 0,
  isArchived: false,
})
const tags: Tag[] = [
  { id: 'f', name: 'focused' },
  { id: 'c', name: 'crash' },
]
let n = 0
const dose = (medicationId: string, ts: number, status: DoseLog['status'] = 'taken'): DoseLog => ({
  id: `d${n++}`,
  medicationId,
  timestamp: ts,
  amount: 10,
  unit: 'mg',
  status,
})
const effect = (ts: number, feel: Feel, medicationIds: string[], tagIds: string[], text = ''): EffectEntry => ({
  id: `e${n++}`,
  timestamp: ts,
  text,
  feel,
  tagIds,
  medicationIds,
})

function fixture(): SummaryData {
  const doseLogs: DoseLog[] = []
  const effects: EffectEntry[] = []
  for (let d = -7; d < 7; d++) {
    const morning = START + d * DAY + 8 * HOUR
    doseLogs.push(dose('a', morning, d === 2 ? 'skipped' : 'taken'), dose('b', morning))
    if (d === 2) continue
    if (d >= 0) {
      effects.push(effect(morning + 2 * HOUR, 'good', ['a'], ['f'], `Focused day ${d}`))
      effects.push(effect(morning + 9 * HOUR, 'bad', ['a'], ['c']))
    } else if (d % 2 === 0) {
      effects.push(effect(morning + 3 * HOUR, 'good', ['a'], ['f']))
    }
  }
  effects.push(effect(START + 3 * DAY + 12 * HOUR, 'neutral', [], [], 'Not sure about this one'))
  effects.push(effect(START + 4 * DAY + 12 * HOUR, 'bad', ['a', 'b'], ['c']))
  const doseChanges: DoseChange[] = [
    { id: 'c1', medicationId: 'a', date: 0, amount: 5, unit: 'mg' },
    { id: 'c2', medicationId: 'a', date: START + 3 * DAY, amount: 10, unit: 'mg' },
  ]
  const checkIns: CheckIn[] = [
    { id: 'k1', date: '2026-10-06', focus: 4, anxiety: 2, mood: 4, sleep: 3 },
    { id: 'k2', date: '2026-10-07', focus: 2, anxiety: 3, mood: 3, sleep: 2 },
    { id: 'k0', date: '2026-10-01', focus: 3, anxiety: 4, mood: 2, sleep: 3 },
  ]
  const notes: Note[] = [{ id: 'n1', createdAt: START + DAY, text: 'Talked to the doctor', medicationId: 'a' }]
  return { medications: [med('a', 'Alpha'), med('b', 'Beta')], effects, doseLogs, doseChanges, checkIns, notes, tags }
}

describe('helpers', () => {
  it('computes quantiles with interpolation', () => {
    expect(quantile([1, 2, 3, 4], 0.5)).toBe(2.5)
    expect(timing([3, 1, 2])).toEqual({ medianHours: 2, p25Hours: 1.5, p75Hours: 2.5, n: 3 })
    expect(timing([])).toBeNull()
  })

  it('finds the previous period of equal length', () => {
    expect(previousPeriod(period)).toEqual({ start: START - 7 * DAY, end: START })
  })
})

describe('buildAggregates (overall)', () => {
  const data = fixture()
  const agg = buildAggregates(data, { kind: 'overall' }, period)

  it('counts entries in the period and the previous one', () => {
    // 6 days x 2 + 1 not sure + 1 linked to both = 14; previous week: d = -6, -4, -2 = 3
    expect(agg.entryCount).toBe(14)
    expect(agg.entryCount).toBe(countEntries(data.effects, { kind: 'overall' }, period))
    expect(agg.previousEntryCount).toBe(3)
  })

  it('splits good versus unwanted', () => {
    expect(agg.feel).toEqual({ good: 6, neutral: 1, bad: 7 })
    expect(agg.previousFeel).toEqual({ good: 3, neutral: 0, bad: 0 })
  })

  it('reports attribution so the model can say when it cannot tell', () => {
    expect(agg.attribution).toMatchObject({ linkedToOne: { Alpha: 12 }, linkedToSeveral: 1, notSure: 1 })
  })

  it('counts tags with feel and the previous period', () => {
    const focused = agg.tags.find((t) => t.tag === 'focused')!
    const crash = agg.tags.find((t) => t.tag === 'crash')!
    expect(focused).toMatchObject({ count: 6, previousCount: 3, feel: { good: 6, neutral: 0, bad: 0 } })
    expect(crash.count).toBe(7)
    expect(agg.tags.find((t) => t.tag === '(untagged)')?.count).toBe(1)
  })

  it('computes typical time after dose for single-medication entries only', () => {
    const focused = agg.tags.find((t) => t.tag === 'focused')!
    expect(focused.typicalTimeAfterDose).toEqual({ medianHours: 2, p25Hours: 2, p75Hours: 2, n: 6 })
    // The crash linked to both medications has no single dose to measure from.
    expect(agg.tags.find((t) => t.tag === 'crash')!.typicalTimeAfterDose?.n).toBe(6)
    const alpha = agg.timingByMedication.find((t) => t.medication === 'Alpha')!
    expect(alpha.good?.medianHours).toBe(2)
    expect(alpha.bad?.medianHours).toBe(9)
  })

  it('reports doses, skips and dose changes in the period', () => {
    const alpha = agg.doses.find((d) => d.medication === 'Alpha')!
    expect(alpha).toMatchObject({ taken: 6, skipped: 1, previousTaken: 7, previousSkipped: 0 })
    expect(alpha.doseChanges).toEqual([{ date: '2026-10-08', from: '5 mg', to: '10 mg' }])
  })

  it('averages check-ins for both periods', () => {
    expect(agg.checkIns.count).toBe(2)
    expect(agg.checkIns.averages).toEqual({ focus: 3, anxiety: 2.5, mood: 3.5, sleep: 2.5 })
    expect(agg.checkIns.previousAverages?.anxiety).toBe(4)
  })

  it('keeps a small, varied sample of the user’s words', () => {
    expect(agg.samples.effects.length).toBeLessThanOrEqual(8)
    expect(new Set(agg.samples.effects.map((s) => s.feel)).size).toBeGreaterThan(1)
    expect(agg.samples.notes).toEqual([{ date: '2026-10-06', about: 'Alpha', text: 'Talked to the doctor' }])
  })
})

describe('buildAggregates (one medication)', () => {
  const data = fixture()
  const agg = buildAggregates(data, { kind: 'medication', medicationId: 'b' }, period)

  it('only counts entries linked to that medication', () => {
    expect(agg.entryCount).toBe(1)
    expect(agg.scope).toEqual({ kind: 'medication', name: 'Beta', currentDose: '10 mg', purpose: '' })
  })

  it('counts nearby "not sure" entries separately', () => {
    expect(agg.attribution.notSureWithin12hOfDose).toBe(1)
  })
})

describe('buildOverview (all time)', () => {
  const data = fixture()
  // From the first entry (the week before START) to the end of October.
  const allTime = { start: START - 7 * DAY, end: new Date(2026, 10, 1).getTime() }
  const agg = buildOverview(data, { kind: 'medication', medicationId: 'a' }, allTime)

  it('counts every entry for the medication, with no previous period', () => {
    // 3 the week before + 12 linked to Alpha alone + 1 linked to both
    expect(agg.entryCount).toBe(16)
    expect(agg).not.toHaveProperty('previousEntryCount')
    expect(agg.tags[0]).not.toHaveProperty('previousCount')
    expect(agg.doses[0]).not.toHaveProperty('previousTaken')
  })

  it('splits entries by month, including empty ones', () => {
    expect(monthsIn({ start: new Date(2026, 7, 20).getTime(), end: new Date(2026, 9, 2).getTime() })).toEqual(['2026-08', '2026-09', '2026-10'])
    expect(agg.byMonth.map((m) => m.month)).toEqual(['2026-09', '2026-10'])
    // Only 29 Sep falls in September.
    expect(agg.byMonth[0]).toMatchObject({ entries: 1, feel: { good: 1, neutral: 0, bad: 0 }, topTags: ['focused'] })
    expect(agg.byMonth[1].entries).toBe(15)
  })

  it('keeps the figures shown next to the text', () => {
    const figures = overviewFigures(agg)
    expect(figures.feel).toEqual(agg.feel)
    expect(figures.months).toHaveLength(2)
    expect(figures.tags[0]).toEqual({ tag: agg.tags[0].tag, count: agg.tags[0].count, feel: agg.tags[0].feel })
  })
})

describe('input size', () => {
  it('stays small for a busy week of real-looking data', () => {
    const sample = generateSampleData(new Date(2026, 9, 10, 20).getTime())
    const end = new Date(2026, 9, 10).getTime()
    const agg = buildAggregates(sample, { kind: 'overall' }, { start: end - 7 * DAY, end })
    expect(agg.entryCount).toBeGreaterThanOrEqual(5)
    const message = buildUserMessage(agg)
    // Small enough for any model: a few thousand characters.
    expect(message.length).toBeLessThan(12_000)
  })
})

describe('prompt', () => {
  it('states every rule the summary must follow', () => {
    for (const h of SUMMARY_HEADINGS) expect(SYSTEM_PROMPT).toContain(`## ${h}`)
    expect(SYSTEM_PROMPT).toMatch(/never give dosing advice or medical advice/i)
    expect(SYSTEM_PROMPT).toMatch(/how many effect entries/i)
    expect(SYSTEM_PROMPT).toMatch(/cannot tell which medication/i)
    expect(SYSTEM_PROMPT).toMatch(/below 5/)
  })

  it('gives the all-time overview the same rules and its own headings', () => {
    for (const h of OVERVIEW_HEADINGS) expect(OVERVIEW_SYSTEM_PROMPT).toContain(`## ${h}`)
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/never give dosing advice or medical advice/i)
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/cannot tell which medication/i)
    expect(OVERVIEW_SYSTEM_PROMPT).toMatch(/byMonth/)
  })

  it('explains when there is not enough data', () => {
    expect(notEnoughDataText(3)).toBe(
      'There is not enough data to summarise this period: it has 3 effect entries, and a summary needs at least 5.',
    )
  })
})
