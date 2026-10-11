import { describe, expect, it } from 'vitest'
import type { CheckIn, DoseLog, EffectEntry, Feel, Tag } from '../db/types'
import { afterDoseBins, dayScore, monthCells, rollingMean, tagBreakdown } from './analytics'
import { DAY, HOUR, MINUTE } from './time'

const T = new Date(2026, 9, 5, 8, 0).getTime()
const tags: Tag[] = [
  { id: 'f', name: 'focused' },
  { id: 'c', name: 'crash' },
]

let n = 0
const dose = (medicationId: string, timestamp: number, status: DoseLog['status'] = 'taken'): DoseLog => ({
  id: `d${n++}`,
  medicationId,
  timestamp,
  amount: 1,
  unit: 'mg',
  status,
})
const effect = (timestamp: number, feel: Feel, medicationIds: string[], tagIds: string[] = [], strength?: 1 | 2 | 3): EffectEntry => ({
  id: `e${n++}`,
  timestamp,
  text: '',
  feel,
  strength,
  tagIds,
  medicationIds,
})
const checkIn = (date: string, mood: number): CheckIn => ({ id: date, date, focus: 3, anxiety: 3, mood, sleep: 3 })

describe('afterDoseBins', () => {
  const logs = [dose('a', T), dose('b', T + HOUR)]

  it('bins linked effects by whole hours after the dose', () => {
    const bins = afterDoseBins(
      [effect(T + 30 * MINUTE, 'good', ['a'], ['f']), effect(T + 2 * HOUR + 5 * MINUTE, 'bad', ['a'], ['c']), effect(T + 2 * HOUR + 50 * MINUTE, 'bad', ['a'], ['c'])],
      logs,
      'a',
      tags,
    )
    expect(bins).toHaveLength(12)
    expect(bins[0]).toMatchObject({ good: 1, total: 1, topTags: ['focused'] })
    expect(bins[2]).toMatchObject({ bad: 2, total: 2, topTags: ['crash'] })
  })

  it('ignores effects linked only to other medications', () => {
    const bins = afterDoseBins([effect(T + HOUR, 'good', ['b'])], logs, 'a', tags)
    expect(bins.every((b) => b.total === 0)).toBe(true)
  })

  it('includes "not sure" effects only when asked', () => {
    const e = [effect(T + HOUR, 'neutral', [])]
    expect(afterDoseBins(e, logs, 'a', tags)[1].total).toBe(0)
    expect(afterDoseBins(e, logs, 'a', tags, { includeUnsure: true })[1].total).toBe(1)
  })

  it('drops effects 12 hours or more after the dose', () => {
    const bins = afterDoseBins([effect(T + 12 * HOUR, 'good', ['a'])], logs, 'a', tags)
    expect(bins.every((b) => b.total === 0)).toBe(true)
  })

  it('measures from the latest taken dose, not a skipped one', () => {
    const bins = afterDoseBins([effect(T + 5 * HOUR, 'good', ['a'])], [dose('a', T), dose('a', T + 4 * HOUR, 'skipped')], 'a', tags)
    expect(bins[5].total).toBe(1)
  })
})

describe('rollingMean', () => {
  it('averages neighbours within the window', () => {
    const pts = [0, 1, 2, 3, 4].map((i) => ({ ts: T + i * DAY, value: i % 2 ? 5 : 1 }))
    const smooth = rollingMean(pts, 2) // ±1 day
    expect(smooth[0].value).toBeCloseTo(3) // (1 + 5) / 2
    expect(smooth[1].value).toBeCloseTo(7 / 3) // (1 + 5 + 1) / 3
  })

  it('handles gaps by averaging only real points', () => {
    const smooth = rollingMean([{ ts: T, value: 4 }, { ts: T + 10 * DAY, value: 2 }], 7)
    expect(smooth.map((p) => p.value)).toEqual([4, 2])
  })
})

describe('dayScore', () => {
  it('is undefined without data', () => {
    expect(dayScore([])).toBeUndefined()
  })

  it('weights effects by strength', () => {
    expect(dayScore([effect(T, 'good', [], [], 3), effect(T, 'bad', [], [], 1)])).toBeCloseTo(0.5)
  })

  it('maps mood 1-5 onto -1..1', () => {
    expect(dayScore([], checkIn('2026-10-05', 5))).toBe(1)
    expect(dayScore([], checkIn('2026-10-05', 3))).toBe(0)
  })

  it('weighs mood and effects equally', () => {
    expect(dayScore([effect(T, 'bad', [])], checkIn('2026-10-05', 5))).toBe(0)
  })
})

describe('monthCells', () => {
  it('returns one cell per day with scores where there is data', () => {
    const cells = monthCells(T, [effect(T, 'good', [])], [checkIn('2026-10-07', 1)])
    expect(cells).toHaveLength(31)
    expect(cells[4]).toMatchObject({ key: '2026-10-05', effects: 1, score: 1 })
    expect(cells[6].score).toBe(-1)
    expect(cells[0].score).toBeUndefined()
  })
})

describe('tagBreakdown', () => {
  it('counts tags per feel for one medication', () => {
    const effects = [
      effect(T, 'good', ['a'], ['f']),
      effect(T, 'good', ['a'], ['f']),
      effect(T, 'bad', ['a'], ['c']),
      effect(T, 'neutral', ['a'], ['c']),
      effect(T, 'good', ['b'], ['f']),
      effect(T, 'bad', ['a']),
    ]
    expect(tagBreakdown(effects, 'a', tags)).toEqual({
      good: [{ tag: 'focused', count: 2 }],
      bad: [
        { tag: 'crash', count: 1 },
        { tag: 'untagged', count: 1 },
      ],
      neutral: 1,
    })
  })
})
