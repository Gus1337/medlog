import { useEffect, useState } from 'react'
import { HABIT_SLOTS, PALETTE_KEYS, type Feel, type PaletteKey } from '../db/types'

export const PALETTE_LABELS: Record<PaletteKey, string> = {
  sage: 'Sage',
  slate: 'Slate',
  sand: 'Sand',
  clay: 'Clay',
  lavender: 'Lavender',
  teal: 'Teal',
}

/** CSS colour for a medication; follows light and dark mode. */
export const medColour = (key: PaletteKey) => `var(--med-${key})`

/** CSS colour for a habit's line colour slot. */
export const habitColour = (slot: number) => `var(--habit-${slot % HABIT_SLOTS})`

export const feelColour = (feel: Feel) => `var(--${feel})`

export const FEEL_LABELS: Record<Feel, string> = { good: 'Good', neutral: 'Neutral', bad: 'Unwanted' }

export interface ThemeColours {
  text: string
  muted: string
  faint: string
  border: string
  surface: string
  surface2: string
  accent: string
  feel: Record<Feel, string>
  med: Record<PaletteKey, string>
  habit: string[]
}

function read(): ThemeColours {
  const css = getComputedStyle(document.documentElement)
  const v = (name: string) => css.getPropertyValue(name).trim()
  return {
    text: v('--text'),
    muted: v('--muted'),
    faint: v('--faint'),
    border: v('--border'),
    surface: v('--surface'),
    surface2: v('--surface-2'),
    accent: v('--accent'),
    feel: { good: v('--good'), neutral: v('--neutral'), bad: v('--bad') },
    med: Object.fromEntries(PALETTE_KEYS.map((k) => [k, v(`--med-${k}`)])) as Record<PaletteKey, string>,
    habit: Array.from({ length: HABIT_SLOTS }, (_, i) => v(`--habit-${i}`)),
  }
}

/** Resolved colour values for SVG charts, refreshed when the colour scheme changes. */
export function useThemeColours(): ThemeColours {
  const [colours, setColours] = useState(read)
  useEffect(() => {
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const update = () => setColours(read())
    mq.addEventListener('change', update)
    return () => mq.removeEventListener('change', update)
  }, [])
  return colours
}
