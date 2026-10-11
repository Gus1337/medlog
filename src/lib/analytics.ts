// Pure calculations behind the Insights graphs.
import type { CheckIn, DoseLog, EffectEntry, Feel, Tag } from '../db/types'
import { DAY, HOUR, dayKey, dayKeyToTs } from './time'
import { indexDoseLogs, sinceDoseForMedication } from './timeSinceDose'

export interface HourBin {
  /** Start of the bin in hours after dose (0-11). */
  hour: number
  label: string
  good: number
  neutral: number
  bad: number
  total: number
  topTags: string[]
}

/**
 * Effects grouped by whole hours since the most recent dose of one medication
 * (0-12h). Effects linked to other medications only are ignored; "not sure"
 * effects are included only when asked.
 */
export function afterDoseBins(
  effects: readonly EffectEntry[],
  doseLogs: readonly DoseLog[],
  medicationId: string,
  tags: readonly Tag[],
  opts: { includeUnsure?: boolean; maxHours?: number } = {},
): HourBin[] {
  const maxHours = opts.maxHours ?? 12
  const taken = indexDoseLogs(doseLogs).get(medicationId)
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const bins = Array.from({ length: maxHours }, (_, hour) => ({
    hour,
    label: `${hour}–${hour + 1}h`,
    good: 0,
    neutral: 0,
    bad: 0,
    total: 0,
    tagCounts: new Map<string, number>(),
  }))
  for (const e of effects) {
    const linked = e.medicationIds.includes(medicationId)
    if (!linked && !(opts.includeUnsure && e.medicationIds.length === 0)) continue
    const since = sinceDoseForMedication(e.timestamp, taken)
    if (!since || since.elapsed >= maxHours * HOUR) continue
    const bin = bins[Math.floor(since.elapsed / HOUR)]
    bin[e.feel]++
    bin.total++
    for (const id of e.tagIds) {
      const name = tagName.get(id)
      if (name) bin.tagCounts.set(name, (bin.tagCounts.get(name) ?? 0) + 1)
    }
  }
  return bins.map(({ tagCounts, ...b }) => ({
    ...b,
    topTags: [...tagCounts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([n]) => n),
  }))
}

export interface SeriesPoint {
  ts: number
  value: number
}

/**
 * Centred rolling mean over calendar days: each point averages the values
 * within ±(windowDays/2) days. Smooths daily check-ins into calm lines.
 */
export function rollingMean(points: readonly SeriesPoint[], windowDays = 7): SeriesPoint[] {
  const half = (windowDays / 2) * DAY
  const sorted = [...points].sort((a, b) => a.ts - b.ts)
  return sorted.map((p) => {
    const near = sorted.filter((q) => Math.abs(q.ts - p.ts) <= half)
    return { ts: p.ts, value: near.reduce((s, q) => s + q.value, 0) / near.length }
  })
}

const FEEL_VALUE: Record<Feel, number> = { good: 1, neutral: 0, bad: -1 }

/**
 * How a day felt, from -1 (harder) to 1 (better), or undefined without data.
 * Effects count by feel, weighted by strength (unrated counts as moderate);
 * the evening mood rating counts as much as all effects together.
 */
export function dayScore(effects: readonly EffectEntry[], checkIn?: CheckIn): number | undefined {
  let effectScore: number | undefined
  if (effects.length > 0) {
    let sum = 0
    let weight = 0
    for (const e of effects) {
      const w = e.strength ?? 2
      sum += FEEL_VALUE[e.feel] * w
      weight += w
    }
    effectScore = sum / weight
  }
  const moodScore = checkIn ? (checkIn.mood - 3) / 2 : undefined
  if (effectScore === undefined) return moodScore
  if (moodScore === undefined) return effectScore
  return (effectScore + moodScore) / 2
}

export interface DayCell {
  key: string
  ts: number
  score?: number
  effects: number
  checkIn?: CheckIn
}

/** One cell per day of the month containing `monthTs`. */
export function monthCells(monthTs: number, effects: readonly EffectEntry[], checkIns: readonly CheckIn[]): DayCell[] {
  const first = new Date(monthTs)
  first.setDate(1)
  first.setHours(0, 0, 0, 0)
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const byDay = new Map<string, EffectEntry[]>()
  for (const e of effects) {
    const k = dayKey(e.timestamp)
    byDay.set(k, [...(byDay.get(k) ?? []), e])
  }
  const checkInByDay = new Map(checkIns.map((c) => [c.date, c]))
  return Array.from({ length: daysInMonth }, (_, i) => {
    const ts = new Date(first.getFullYear(), first.getMonth(), i + 1).getTime()
    const key = dayKey(ts)
    const dayEffects = byDay.get(key) ?? []
    const checkIn = checkInByDay.get(key)
    return { key, ts: dayKeyToTs(key), score: dayScore(dayEffects, checkIn), effects: dayEffects.length, checkIn }
  })
}

export interface TagCount {
  tag: string
  count: number
}

/** Most common tags among effects linked to a medication, split into good and unwanted. */
export function tagBreakdown(
  effects: readonly EffectEntry[],
  medicationId: string,
  tags: readonly Tag[],
  limit = 6,
): { good: TagCount[]; bad: TagCount[]; neutral: number } {
  const tagName = new Map(tags.map((t) => [t.id, t.name]))
  const counts = { good: new Map<string, number>(), bad: new Map<string, number>() }
  let neutral = 0
  for (const e of effects) {
    if (!e.medicationIds.includes(medicationId)) continue
    if (e.feel === 'neutral') {
      neutral++
      continue
    }
    const names = e.tagIds.map((id) => tagName.get(id)).filter((n): n is string => !!n)
    for (const name of names.length ? names : ['untagged']) counts[e.feel].set(name, (counts[e.feel].get(name) ?? 0) + 1)
  }
  const top = (m: Map<string, number>) =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
      .slice(0, limit)
      .map(([tag, count]) => ({ tag, count }))
  return { good: top(counts.good), bad: top(counts.bad), neutral }
}
