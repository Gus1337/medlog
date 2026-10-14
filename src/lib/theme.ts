import { getSetting, setSetting } from '../db/db'

export const THEME_MODES = ['system', 'light', 'dark'] as const
export type ThemeMode = (typeof THEME_MODES)[number]

export const THEME_LABELS: Record<ThemeMode, string> = { system: 'System', light: 'Light', dark: 'Dark' }

const THEME_SETTING = 'theme'
/** Mirrors the chosen theme outside Dexie so it can be applied before the database opens, avoiding a flash. */
const LOCAL_STORAGE_KEY = 'medlog-theme'

function isThemeMode(v: unknown): v is ThemeMode {
  return typeof v === 'string' && (THEME_MODES as readonly string[]).includes(v)
}

/** The last-applied theme, read synchronously (for the earliest possible paint). */
export function readLocalTheme(): ThemeMode {
  try {
    const v = localStorage.getItem(LOCAL_STORAGE_KEY)
    if (isThemeMode(v)) return v
  } catch {
    // Storage can be unavailable (private browsing, blocked cookies); fall back to system.
  }
  return 'system'
}

/** Sets the `data-theme` attribute the stylesheet reacts to. 'system' clears it, following the OS setting. */
export function applyTheme(mode: ThemeMode) {
  const root = document.documentElement
  if (mode === 'system') root.removeAttribute('data-theme')
  else root.setAttribute('data-theme', mode)

  // Keep the PWA's status-bar colour (the <meta name="theme-color"> tags) matching a forced theme too.
  const lightMeta = document.querySelector('meta[data-theme-meta="light"]')
  const darkMeta = document.querySelector('meta[data-theme-meta="dark"]')
  if (!(lightMeta instanceof HTMLMetaElement) || !(darkMeta instanceof HTMLMetaElement)) return
  if (mode === 'light') {
    lightMeta.media = 'all'
    darkMeta.media = 'not all'
  } else if (mode === 'dark') {
    darkMeta.media = 'all'
    lightMeta.media = 'not all'
  } else {
    lightMeta.media = '(prefers-color-scheme: light)'
    darkMeta.media = '(prefers-color-scheme: dark)'
  }
}

export const getTheme = async (): Promise<ThemeMode> => (await getSetting<ThemeMode>(THEME_SETTING)) ?? 'system'

export async function setTheme(mode: ThemeMode) {
  await setSetting(THEME_SETTING, mode)
  try {
    localStorage.setItem(LOCAL_STORAGE_KEY, mode)
  } catch {
    // Ignored; the next load falls back to 'system' until Dexie's value is read.
  }
  applyTheme(mode)
}
