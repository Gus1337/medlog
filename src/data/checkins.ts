import { db, getSetting, newId, setSetting } from '../db/db'
import type { CheckIn } from '../db/types'

export type CheckInValues = Pick<CheckIn, 'focus' | 'anxiety' | 'mood' | 'sleep'>

/** Saves the check-in for a day, replacing any earlier one for the same day. */
export async function saveCheckIn(date: string, values: CheckInValues) {
  const existing = await db.checkIns.where('date').equals(date).first()
  await db.checkIns.put({ id: existing?.id ?? newId(), date, ...values })
}

const SKIP_KEY = 'checkInSkippedOn'

export const skipCheckIn = (date: string) => setSetting(SKIP_KEY, date)
export const unskipCheckIn = () => setSetting(SKIP_KEY, null)
export const checkInSkippedOn = () => getSetting<string | null>(SKIP_KEY)
