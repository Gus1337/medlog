import { describe, expect, it } from 'vitest'
import type { DoseLog, EffectEntry, Medication } from '../db/types'
import {
  describeSinceDose,
  indexDoseLogs,
  sinceDoseForMedication,
  timeSinceDose,
  timeSinceDoseForEffect,
} from './timeSinceDose'
import { DAY, HOUR, MINUTE } from './time'

const T = new Date(2026, 9, 10, 12, 0).getTime()

let n = 0
function dose(medicationId: string, timestamp: number, status: DoseLog['status'] = 'taken'): DoseLog {
  return { id: `d${n++}`, medicationId, timestamp, amount: 10, unit: 'mg', status }
}

function effect(timestamp: number, medicationIds: string[] = []): EffectEntry {
  return { id: 'e', timestamp, text: '', feel: 'neutral', tagIds: [], medicationIds }
}

const meds: Medication[] = [
  { id: 'a', name: 'Alpha', doseAmount: 10, unit: 'mg', purpose: '', colour: 'sage', usualTimes: [], startDate: 0, isArchived: false },
]

describe('timeSinceDose', () => {
  it('returns nothing without doses', () => {
    expect(timeSinceDose(T, [])).toEqual([])
  })

  it('uses the most recent taken dose per medication', () => {
    const logs = [dose('a', T - 5 * HOUR), dose('a', T - 2 * HOUR - 10 * MINUTE), dose('b', T - 1 * HOUR)]
    const result = timeSinceDose(T, logs)
    expect(result).toHaveLength(2)
    expect(result.find((r) => r.medicationId === 'a')?.elapsed).toBe(2 * HOUR + 10 * MINUTE)
    expect(result.find((r) => r.medicationId === 'b')?.elapsed).toBe(HOUR)
  })

  it('orders results with the most recent dose first', () => {
    const logs = [dose('a', T - 5 * HOUR), dose('b', T - 1 * HOUR)]
    expect(timeSinceDose(T, logs).map((r) => r.medicationId)).toEqual(['b', 'a'])
  })

  it('ignores skipped doses', () => {
    const logs = [dose('a', T - 6 * HOUR), dose('a', T - 1 * HOUR, 'skipped')]
    expect(timeSinceDose(T, logs)[0].elapsed).toBe(6 * HOUR)
  })

  it('ignores doses after the moment', () => {
    const logs = [dose('a', T + MINUTE)]
    expect(timeSinceDose(T, logs)).toEqual([])
  })

  it('counts a dose at the same moment as zero elapsed', () => {
    expect(timeSinceDose(T, [dose('a', T)])[0].elapsed).toBe(0)
  })

  it('includes a dose exactly 24 hours earlier but not older', () => {
    expect(timeSinceDose(T, [dose('a', T - DAY)])).toHaveLength(1)
    expect(timeSinceDose(T, [dose('a', T - DAY - 1)])).toEqual([])
  })

  it('works across midnight', () => {
    const late = new Date(2026, 9, 9, 23, 30).getTime()
    const early = new Date(2026, 9, 10, 1, 15).getTime()
    expect(timeSinceDose(early, [dose('a', late)])[0].elapsed).toBe(HOUR + 45 * MINUTE)
  })
})

describe('timeSinceDoseForEffect', () => {
  const logs = [dose('a', T - 2 * HOUR), dose('b', T - 3 * HOUR)]

  it('reports only linked medications', () => {
    expect(timeSinceDoseForEffect(effect(T, ['b']), logs).map((r) => r.medicationId)).toEqual(['b'])
  })

  it('reports every recent medication when not sure', () => {
    expect(timeSinceDoseForEffect(effect(T), logs)).toHaveLength(2)
  })

  it('reports nothing for a linked medication without a recent dose', () => {
    expect(timeSinceDoseForEffect(effect(T, ['c']), logs)).toEqual([])
  })
})

describe('describeSinceDose', () => {
  it('formats hours and minutes with the medication name', () => {
    const [s] = timeSinceDose(T, [dose('a', T - 2 * HOUR - 10 * MINUTE)])
    expect(describeSinceDose(s, meds)).toBe('2h 10m after Alpha')
  })

  it('formats short gaps in minutes', () => {
    const [s] = timeSinceDose(T, [dose('a', T - 45 * MINUTE)])
    expect(describeSinceDose(s, meds)).toBe('45m after Alpha')
  })
})

describe('sinceDoseForMedication (indexed)', () => {
  it('agrees with timeSinceDose on random data', () => {
    let seed = 7
    const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647)
    const logs: DoseLog[] = []
    for (let i = 0; i < 200; i++) {
      logs.push(dose(rand() < 0.5 ? 'a' : 'b', T - rand() * 10 * DAY, rand() < 0.1 ? 'skipped' : 'taken'))
    }
    const index = indexDoseLogs(logs)
    for (let i = 0; i < 100; i++) {
      const at = T - rand() * 10 * DAY
      const expected = timeSinceDose(at, logs)
      for (const med of ['a', 'b']) {
        const fast = sinceDoseForMedication(at, index.get(med))
        expect(fast?.elapsed).toBe(expected.find((e) => e.medicationId === med)?.elapsed)
      }
    }
  })
})
