// Date helpers. All "days" are local calendar days.

export const MINUTE = 60_000
export const HOUR = 60 * MINUTE
export const DAY = 24 * HOUR

const pad = (n: number) => String(n).padStart(2, '0')

/** "YYYY-MM-DD" for the local day containing ts. */
export function dayKey(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** Local midnight at the start of the day containing ts. */
export function startOfDay(ts: number): number {
  const d = new Date(ts)
  d.setHours(0, 0, 0, 0)
  return d.getTime()
}

/** Adds calendar days (DST-safe). */
export function addDays(ts: number, days: number): number {
  const d = new Date(ts)
  d.setDate(d.getDate() + days)
  return d.getTime()
}

export function dayKeyToTs(key: string): number {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, m - 1, d).getTime()
}

/** Monday 00:00 of the week containing ts. */
export function startOfWeek(ts: number): number {
  const d = new Date(startOfDay(ts))
  const offset = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - offset)
  return d.getTime()
}

/** Applies "HH:MM" to the local day containing ts. */
export function atTimeOfDay(ts: number, hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number)
  const d = new Date(ts)
  d.setHours(h, m, 0, 0)
  return d.getTime()
}

export function formatTime(ts: number): string {
  return new Date(ts).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })
}

export function formatDay(ts: number, now = Date.now()): string {
  const key = dayKey(ts)
  if (key === dayKey(now)) return 'Today'
  if (key === dayKey(addDays(now, -1))) return 'Yesterday'
  return new Date(ts).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })
}

export function formatShortDate(ts: number): string {
  return new Date(ts).toLocaleDateString(undefined, { day: 'numeric', month: 'short' })
}

export function formatDateTime(ts: number): string {
  return new Date(ts).toLocaleString(undefined, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

/** Value for <input type="datetime-local">. */
export function toDateTimeLocal(ts: number): string {
  const d = new Date(ts)
  return `${dayKey(ts)}T${pad(d.getHours())}:${pad(d.getMinutes())}`
}

export function fromDateTimeLocal(value: string): number {
  return new Date(value).getTime()
}

/** "2h 10m", "45m", "0m". */
export function formatDuration(ms: number): string {
  const totalMin = Math.max(0, Math.floor(ms / MINUTE))
  const h = Math.floor(totalMin / 60)
  const m = totalMin % 60
  if (h === 0) return `${m}m`
  if (m === 0) return `${h}h`
  return `${h}h ${m}m`
}
