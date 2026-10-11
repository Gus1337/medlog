import { describe, expect, it } from 'vitest'
import type { Habit, HabitLog } from '../db/types'
import { amountSeries, describeTarget, parseAmount, periodStats, progressSeries, weekProgress } from './habits'
import { addDays, dayKey, dayKeyToTs } from './time'

const habit = (over: Partial<Habit> = {}): Habit => ({
  id: 'h',
  name: 'Read',
  kind: 'check',
  unit: '',
  dailyTarget: 1,
  weeklyTarget: 5,
  colour: 0,
  createdAt: dayKeyToTs('2026-09-01'),
  isArchived: false,
  ...over,
})

const log = (date: string, value = 1, habitId = 'h'): HabitLog => ({ id: `${habitId}-${date}`, habitId, date, value, updatedAt: 0 })

describe('weekProgress', () => {
  it('counts on-target days from Monday to today', () => {
    // 2026-10-07 is a Wednesday.
    const now = dayKeyToTs('2026-10-07') + 15 * 3600_000
    const logs = [log('2026-10-04'), log('2026-10-05'), log('2026-10-07'), log('2026-10-08')]
    expect(weekProgress(habit(), logs, now)).toEqual({ done: 2, target: 5 })
  })

  it('only counts amounts that reach the daily target', () => {
    const steps = habit({ kind: 'amount', unit: 'steps', dailyTarget: 10000, weeklyTarget: 7 })
    const now = dayKeyToTs('2026-10-06') + 3600_000
    expect(weekProgress(steps, [log('2026-10-05', 9999), log('2026-10-06', 12000)], now).done).toBe(1)
  })
})

describe('progressSeries', () => {
  const from = dayKeyToTs('2026-09-01')
  const to = dayKeyToTs('2026-09-15')
  const now = dayKeyToTs('2026-09-12') + 3600_000

  it('counts on-target days over a rolling week and scales the first week', () => {
    const logs = [log('2026-09-01'), log('2026-09-02'), log('2026-09-03'), log('2026-09-08')]
    const s = progressSeries(habit(), logs, from, to, now)
    expect(s[0]).toMatchObject({ days: 1, pct: 100 }) // 1 of 5/7 expected after one day
    expect(s[6]).toMatchObject({ days: 3, pct: 60 }) // Sep 7: 3 of 5
    expect(s[7]).toMatchObject({ days: 3, pct: 60 }) // Sep 8: Sep 2-8
    expect(s[9]).toMatchObject({ days: 1, pct: 20 }) // Sep 10: Sep 4-10 has only Sep 8
  })

  it('leaves days before the start and after today empty', () => {
    const s = progressSeries(habit({ createdAt: dayKeyToTs('2026-09-05') }), [], from, to, now)
    expect(s[3].days).toBeNull()
    expect(s[4]).toMatchObject({ days: 0, pct: 0 })
    expect(s[11].days).not.toBeNull() // Sep 12 is today
    expect(s[12].days).toBeNull()
  })

  it('starts earlier when a day before the habit was added is logged', () => {
    const s = progressSeries(habit({ createdAt: dayKeyToTs('2026-09-05') }), [log('2026-09-02')], from, to, now)
    expect(s[1]).toMatchObject({ days: 1 })
  })

  it('caps progress at 100%', () => {
    const logs = Array.from({ length: 7 }, (_, i) => log(dayKey(addDays(from, i))))
    const s = progressSeries(habit({ weeklyTarget: 3 }), logs, from, to, now)
    expect(s[6]).toMatchObject({ days: 7, pct: 100 })
  })

  it('ignores other habits', () => {
    const s = progressSeries(habit(), [log('2026-09-01', 1, 'other')], from, to, now)
    expect(s[0].days).toBe(0)
  })
})

describe('periodStats and amountSeries', () => {
  const steps = habit({ kind: 'amount', unit: 'steps', dailyTarget: 10000, weeklyTarget: 7 })
  const logs = [log('2026-09-01', 12000), log('2026-09-02', 4000), log('2026-09-04', 10000)]
  const from = dayKeyToTs('2026-09-01')
  const to = dayKeyToTs('2026-09-08')

  it('sums logged days and counts days since the start', () => {
    const now = dayKeyToTs('2026-09-04')
    expect(periodStats(steps, logs, from, to, now)).toEqual({ daysOnTarget: 2, days: 4, total: 26000, averagePerLoggedDay: 26000 / 3 })
  })

  it('lists amounts oldest first', () => {
    expect(amountSeries(steps, [...logs].reverse(), from, to).map((p) => p.value)).toEqual([12000, 4000, 10000])
  })

  it('describes targets', () => {
    expect(describeTarget(habit())).toBe('5 days a week')
    expect(describeTarget(habit({ weeklyTarget: 7 }))).toBe('Every day')
    expect(describeTarget(steps)).toMatch(/^10[,. ]?000 steps, every day$/)
  })
})

describe('parseAmount', () => {
  it('reads thousands separators and decimal commas', () => {
    expect(parseAmount('10000')).toBe(10000)
    expect(parseAmount('10 000')).toBe(10000)
    expect(parseAmount('10,000')).toBe(10000)
    expect(parseAmount('10.000')).toBe(10000)
    expect(parseAmount('10k')).toBe(10000)
    expect(parseAmount('7.5K')).toBe(7500)
    expect(parseAmount('2,5')).toBe(2.5)
    expect(parseAmount('2.5')).toBe(2.5)
    expect(parseAmount('')).toBeNaN()
    expect(parseAmount('ten')).toBeNaN()
  })
})
