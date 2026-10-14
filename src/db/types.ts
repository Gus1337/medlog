// Record types stored in IndexedDB. Timestamps are epoch milliseconds; ids are
// random UUIDs so a JSON backup can be restored without id clashes.

export type Feel = 'good' | 'neutral' | 'bad'
export type DoseStatus = 'taken' | 'skipped'

export const PALETTE_KEYS = ['sage', 'slate', 'sand', 'clay', 'lavender', 'teal'] as const
export type PaletteKey = (typeof PALETTE_KEYS)[number]

export interface Medication {
  id: string
  name: string
  doseAmount: number
  unit: string
  purpose: string
  colour: PaletteKey
  /** Usual times of day as "HH:MM", e.g. ["08:00"]. */
  usualTimes: string[]
  startDate: number
  isArchived: boolean
}

/** Recorded whenever a medication's dose is edited (and once when it is added). */
export interface DoseChange {
  id: string
  medicationId: string
  date: number
  amount: number
  unit: string
}

export interface DoseLog {
  id: string
  medicationId: string
  timestamp: number
  amount: number
  unit: string
  status: DoseStatus
}

export interface EffectEntry {
  id: string
  timestamp: number
  text: string
  feel: Feel
  /** 1-3, optional. */
  strength?: 1 | 2 | 3
  tagIds: string[]
  /** Empty means "not sure". */
  medicationIds: string[]
}

export interface Tag {
  id: string
  name: string
}

export interface Note {
  id: string
  createdAt: number
  text: string
  /** Undefined means a day note. */
  medicationId?: string
}

export interface CheckIn {
  id: string
  /** Local calendar day, "YYYY-MM-DD". */
  date: string
  focus: number
  anxiety: number
  mood: number
  sleep: number
}

export interface Summary {
  id: string
  createdAt: number
  periodStart: number
  periodEnd: number
  /** "overall" or a medication id. */
  scope: string
  text: string
  entryCount: number
  /** Which AI provider wrote it. Absent on summaries written before provider choice existed (Claude). */
  provider?: 'claude' | 'openai'
}

/** Yes/no habits are done or not; amount habits count something (steps, pages, minutes). */
export type HabitKind = 'check' | 'amount'

/** Number of line colours for habits, validated as a set for colour-blind separation. */
export const HABIT_SLOTS = 6

export interface Habit {
  id: string
  name: string
  kind: HabitKind
  /** Unit for amount habits ("steps", "min"); empty for yes/no habits. */
  unit: string
  /** Amount that counts as "on target" for a day; 1 for yes/no habits. */
  dailyTarget: number
  /** Days per week you aim to be on target, 1-7. */
  weeklyTarget: number
  /** Index into the habit colours, 0 to HABIT_SLOTS - 1. */
  colour: number
  createdAt: number
  isArchived: boolean
}

/** One per habit per day. */
export interface HabitLog {
  id: string
  habitId: string
  /** Local calendar day, "YYYY-MM-DD". */
  date: string
  /** 1 for a yes/no habit; the amount for an amount habit. */
  value: number
  updatedAt: number
}

/** Small key-value store for app settings (API key, PIN hash, backup date...). */
export interface Setting {
  key: string
  value: unknown
}
