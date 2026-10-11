// Habit progress. Everything works on local calendar days ("YYYY-MM-DD").
import type { Habit, HabitLog } from '../db/types'
import { addDays, dayKey, dayKeyToTs, startOfDay, startOfWeek } from './time'

export const onTarget = (habit: Habit, value: number | undefined) => value !== undefined && value > 0 && value >= habit.dailyTarget

/** Logged value per day for one habit. */
export function valuesByDay(habit: Habit, logs: readonly HabitLog[]): Map<string, number> {
  const out = new Map<string, number>()
  for (const l of logs) if (l.habitId === habit.id) out.set(l.date, l.value)
  return out
}

/** First day the habit counts from: the day it was added, or an earlier logged day. */
export function habitStart(habit: Habit, logs: readonly HabitLog[]): number {
  let start = startOfDay(habit.createdAt)
  for (const l of logs) if (l.habitId === habit.id) start = Math.min(start, dayKeyToTs(l.date))
  return start
}

/** Each local day from `from` up to (not including) `to`, as midnight timestamps. */
export function eachDay(from: number, to: number): number[] {
  const out: number[] = []
  for (let t = startOfDay(from); t < to; t = addDays(t, 1)) out.push(t)
  return out
}

export interface WeekProgress {
  /** Days on target so far this week (Monday to today). */
  done: number
  target: number
}

export function weekProgress(habit: Habit, logs: readonly HabitLog[], now: number): WeekProgress {
  const values = valuesByDay(habit, logs)
  let done = 0
  for (const t of eachDay(startOfWeek(now), addDays(startOfDay(now), 1))) if (onTarget(habit, values.get(dayKey(t)))) done++
  return { done, target: habit.weeklyTarget }
}

export interface ProgressPoint {
  ts: number
  /** Days on target in the 7 days ending this day; null before the habit started. */
  days: number | null
  /**
   * Progress toward the weekly target over those 7 days, 0-100. In the first
   * week the target is scaled to the days the habit has existed.
   */
  pct: number | null
}

/**
 * A daily line of progress: for each day in [from, to), how many of the last
 * 7 days were on target. `logs` should include the 6 days before `from`.
 * Days after `now` are left empty.
 */
export function progressSeries(habit: Habit, logs: readonly HabitLog[], from: number, to: number, now: number): ProgressPoint[] {
  const values = valuesByDay(habit, logs)
  const start = habitStart(habit, logs)
  const today = startOfDay(now)
  return eachDay(from, to).map((ts) => {
    if (ts < start || ts > today) return { ts, days: null, pct: null }
    let days = 0
    let available = 0
    for (let i = 0; i < 7; i++) {
      const d = addDays(ts, -i)
      if (d < start) break
      available++
      if (onTarget(habit, values.get(dayKey(d)))) days++
    }
    const expected = (habit.weeklyTarget * available) / 7
    return { ts, days, pct: Math.round(Math.min(1, days / expected) * 100) }
  })
}

export interface AmountPoint {
  ts: number
  value: number
}

/** Logged amounts per day in [from, to), oldest first. */
export function amountSeries(habit: Habit, logs: readonly HabitLog[], from: number, to: number): AmountPoint[] {
  return logs
    .filter((l) => l.habitId === habit.id)
    .map((l) => ({ ts: dayKeyToTs(l.date), value: l.value }))
    .filter((p) => p.ts >= from && p.ts < to)
    .sort((a, b) => a.ts - b.ts)
}

export interface PeriodStats {
  daysOnTarget: number
  /** Days in the period since the habit started, up to today. */
  days: number
  /** Sum and average of logged amounts (amount habits). */
  total: number
  averagePerLoggedDay: number | null
}

export function periodStats(habit: Habit, logs: readonly HabitLog[], from: number, to: number, now: number): PeriodStats {
  const values = valuesByDay(habit, logs)
  const start = habitStart(habit, logs)
  const days = eachDay(Math.max(from, start), Math.min(to, addDays(startOfDay(now), 1)))
  let daysOnTarget = 0
  let total = 0
  let logged = 0
  for (const t of days) {
    const v = values.get(dayKey(t))
    if (v === undefined) continue
    logged++
    total += v
    if (onTarget(habit, v)) daysOnTarget++
  }
  return { daysOnTarget, days: days.length, total, averagePerLoggedDay: logged ? total / logged : null }
}

/** "10,000 steps", "30 min", "Done". */
export function formatAmount(habit: Habit, value: number): string {
  if (habit.kind === 'check') return 'Done'
  return `${value.toLocaleString()}${habit.unit ? ` ${habit.unit}` : ''}`
}

/** "On target 5 days a week", "10,000 steps, 7 days a week". */
export function describeTarget(habit: Habit): string {
  const week = habit.weeklyTarget === 7 ? 'every day' : `${habit.weeklyTarget} ${habit.weeklyTarget === 1 ? 'day' : 'days'} a week`
  return habit.kind === 'check' ? week.replace(/^./, (c) => c.toUpperCase()) : `${formatAmount(habit, habit.dailyTarget)}, ${week}`
}

/**
 * Reads a typed amount: "10000", "10 000", "10,000" and "10.000" are ten
 * thousand, as is "10k"; "2,5" and "2.5" are two and a half. NaN when unreadable.
 */
export function parseAmount(text: string): number {
  const s = text.trim().replace(/\s/g, '')
  const k = /^(\d+(?:[.,]\d+)?)k$/i.exec(s)
  if (k) return Math.round(Number(k[1].replace(',', '.')) * 1000)
  if (/^\d{1,3}([.,]\d{3})+$/.test(s)) return Number(s.replace(/[.,]/g, ''))
  if (!/^\d*[.,]?\d+$/.test(s)) return NaN
  return Number(s.replace(',', '.'))
}
