// Debug-only sample data. Imported dynamically behind `import.meta.env.DEV`,
// so it is not part of production builds.
import { DATA_TABLES, db, newId } from '../db/db'
import type { CheckIn, DoseChange, DoseLog, EffectEntry, Feel, Medication, Note, Tag } from '../db/types'
import { HOUR, MINUTE, addDays, atTimeOfDay, dayKey, startOfDay } from '../lib/time'

export interface SampleData {
  medications: Medication[]
  doseChanges: DoseChange[]
  doseLogs: DoseLog[]
  effects: EffectEntry[]
  tags: Tag[]
  notes: Note[]
  checkIns: CheckIn[]
}

interface EffectTemplate {
  tag: string
  feel: Feel
  /** Hours after dose: [min, max]. */
  window: [number, number]
  chance: number
  texts: string[]
  strength?: [1 | 2 | 3, 1 | 2 | 3]
  /** Chance the entry is linked to the medication rather than "not sure". */
  linkChance?: number
}

const STIM: EffectTemplate[] = [
  { tag: 'focused', feel: 'good', window: [0.8, 4], chance: 0.75, strength: [2, 3], texts: ['Got into deep work easily', 'Reading feels effortless', 'Cleared my inbox without drifting', 'Could follow the whole meeting'] },
  { tag: 'appetite loss', feel: 'bad', window: [2, 5], chance: 0.45, strength: [1, 2], texts: ['Skipped lunch without noticing', 'Not hungry at all', 'Had to force myself to eat'] },
  { tag: 'dry mouth', feel: 'bad', window: [2, 6], chance: 0.25, strength: [1, 1], texts: ['Very dry mouth', 'Drinking a lot of water'] },
  { tag: 'motivated', feel: 'good', window: [1, 3.5], chance: 0.35, strength: [1, 2], texts: ['Started chores without the usual dread', 'Felt like getting things done'] },
  { tag: 'crash', feel: 'bad', window: [8.5, 11], chance: 0.45, strength: [1, 3], texts: ['Sudden tiredness late afternoon', 'Hit a wall around dinner', 'Energy just dropped'] },
  { tag: 'irritable', feel: 'bad', window: [9, 11.5], chance: 0.2, strength: [1, 2], texts: ['Short-tempered in the evening', 'Snappy with people'] },
  { tag: 'jittery', feel: 'bad', window: [1, 2.5], chance: 0.12, strength: [1, 2], texts: ['A bit shaky', 'Heart racing slightly'], linkChance: 0.5 },
]

const SSRI: EffectTemplate[] = [
  { tag: 'nausea', feel: 'bad', window: [0.5, 3], chance: 0.35, strength: [1, 2], texts: ['Queasy after breakfast', 'Mild nausea'], linkChance: 0.7 },
  { tag: 'calm', feel: 'good', window: [2, 9], chance: 0.35, strength: [1, 2], texts: ['Felt steady through a stressful call', 'Calmer than usual', 'Did not spiral about the deadline'] },
  { tag: 'sleepy', feel: 'neutral', window: [3, 6], chance: 0.2, strength: [1, 2], texts: ['Drowsy after lunch', 'Yawning a lot'], linkChance: 0.4 },
]

const UNSURE: EffectTemplate[] = [
  { tag: 'headache', feel: 'bad', window: [3, 10], chance: 0.12, strength: [1, 2], texts: ['Dull headache', 'Pressure behind the eyes'], linkChance: 0 },
  { tag: 'restless', feel: 'neutral', window: [2, 7], chance: 0.1, texts: ['Hard to sit still', 'Fidgety'], linkChance: 0 },
]

function rng(seed: number) {
  let s = seed % 2147483647
  if (s <= 0) s += 2147483646
  return () => (s = (s * 16807) % 2147483647) / 2147483647
}

export function generateSampleData(now = Date.now(), days = 35, seed = 42): SampleData {
  const rand = rng(seed)
  const between = (a: number, b: number) => a + rand() * (b - a)
  const pick = <T,>(xs: T[]) => xs[Math.floor(rand() * xs.length)]

  const today = startOfDay(now)
  const first = addDays(today, -days)

  const stim: Medication = {
    id: newId(), name: 'Lisdexamfetamine', doseAmount: 40, unit: 'mg', purpose: 'Focus (ADHD)',
    colour: 'sage', usualTimes: ['07:30'], startDate: first, isArchived: false,
  }
  const ssri: Medication = {
    id: newId(), name: 'Sertraline', doseAmount: 50, unit: 'mg', purpose: 'Anxiety',
    colour: 'lavender', usualTimes: ['08:00'], startDate: first, isArchived: false,
  }
  const stimChangeDay = addDays(today, -16)
  const doseChanges: DoseChange[] = [
    { id: newId(), medicationId: stim.id, date: first, amount: 30, unit: 'mg' },
    { id: newId(), medicationId: ssri.id, date: first, amount: 50, unit: 'mg' },
    { id: newId(), medicationId: stim.id, date: atTimeOfDay(stimChangeDay, '07:00'), amount: 40, unit: 'mg' },
  ]

  const tagByName = new Map<string, Tag>()
  const tagId = (name: string) => {
    if (!tagByName.has(name)) tagByName.set(name, { id: newId(), name })
    return tagByName.get(name)!.id
  }

  const doseLogs: DoseLog[] = []
  const effects: EffectEntry[] = []
  const checkIns: CheckIn[] = []
  const notes: Note[] = []

  for (let i = 0; i <= days; i++) {
    const day = addDays(first, i)
    const isToday = day === today
    const weekend = [0, 6].includes(new Date(day).getDay())
    const progress = i / days // 0 at start, 1 today

    const stimAmount = day >= stimChangeDay ? 40 : 30
    const stimTaken = rand() > (weekend ? 0.3 : 0.04)
    const ssriTaken = rand() > 0.04
    const stimAt = atTimeOfDay(day, '07:30') + between(-20, 45) * MINUTE
    const ssriAt = atTimeOfDay(day, '08:00') + between(-15, 40) * MINUTE

    const maybeLog = (med: Medication, at: number, amount: number, taken: boolean) => {
      if (at > now) return
      doseLogs.push({ id: newId(), medicationId: med.id, timestamp: at, amount, unit: med.unit, status: taken ? 'taken' : 'skipped' })
    }
    maybeLog(stim, stimAt, stimAmount, stimTaken)
    maybeLog(ssri, ssriAt, 50, ssriTaken)

    const addEffects = (templates: EffectTemplate[], doseAt: number, med: Medication | null, scale = 1) => {
      for (const t of templates) {
        let chance = t.chance * scale
        if (t.tag === 'nausea') chance *= 1.4 - progress // fades over the weeks
        if (t.tag === 'calm') chance *= 0.5 + progress // builds over the weeks
        if (t.tag === 'focused' && stimAmount === 40) chance *= 1.15
        if (t.tag === 'crash' && stimAmount === 40) chance *= 1.3
        if (rand() > chance) continue
        const at = doseAt + between(t.window[0], t.window[1]) * HOUR
        if (at > now) continue
        const linked = med && rand() < (t.linkChance ?? 0.85)
        const [smin, smax] = t.strength ?? [0, 0]
        effects.push({
          id: newId(),
          timestamp: Math.round(at / MINUTE) * MINUTE,
          text: pick(t.texts),
          feel: t.feel,
          strength: smin ? (Math.round(between(smin, smax)) as 1 | 2 | 3) : undefined,
          tagIds: [tagId(t.tag)],
          medicationIds: linked ? [med.id] : [],
        })
      }
    }
    if (stimTaken) addEffects(STIM, stimAt, stim)
    if (ssriTaken) addEffects(SSRI, ssriAt, ssri)
    addEffects(UNSURE, Math.min(stimAt, ssriAt), null)

    // Evening check-in on most days (not yet for today).
    if (!isToday && rand() < 0.85) {
      const clamp = (v: number) => Math.max(1, Math.min(5, Math.round(v)))
      checkIns.push({
        id: newId(),
        date: dayKey(day),
        focus: clamp((stimTaken ? 3.6 : 2.2) + between(-0.8, 0.8) + (stimAmount === 40 ? 0.3 : 0)),
        anxiety: clamp(3.6 - progress * 1.4 + between(-0.8, 0.8)),
        mood: clamp(2.9 + progress * 0.8 + between(-0.9, 0.9)),
        sleep: clamp(3.3 + between(-1.2, 1) - (stimAmount === 40 ? 0.3 : 0)),
      })
    }

    if (i === 3) notes.push({ id: newId(), createdAt: atTimeOfDay(day, '21:00'), medicationId: ssri.id, text: 'Prescriber said nausea usually settles within the first few weeks. Taking it with breakfast seems to help.' })
    if (day === stimChangeDay) notes.push({ id: newId(), createdAt: atTimeOfDay(day, '19:30'), medicationId: stim.id, text: 'Dose raised from 30 mg to 40 mg after review. Watch for the late-afternoon crash and sleep.' })
    if (i === 10) notes.push({ id: newId(), createdAt: atTimeOfDay(day, '22:00'), text: 'Poor night before, so hard to tell what was the medication today.' })
    if (i === days - 5) notes.push({ id: newId(), createdAt: atTimeOfDay(day, '20:15'), text: 'Busy day with travel. Ate late.' })
  }

  return {
    medications: [stim, ssri],
    doseChanges,
    doseLogs,
    effects,
    tags: [...tagByName.values()],
    notes,
    checkIns,
  }
}

/** Replaces all data with sample data. */
export async function loadSampleData() {
  const data = generateSampleData()
  await db.transaction('rw', DATA_TABLES.map((t) => db[t]), async () => {
    for (const t of DATA_TABLES) await db[t].clear()
    await db.medications.bulkAdd(data.medications)
    await db.doseChanges.bulkAdd(data.doseChanges)
    await db.doseLogs.bulkAdd(data.doseLogs)
    await db.effects.bulkAdd(data.effects)
    await db.tags.bulkAdd(data.tags)
    await db.notes.bulkAdd(data.notes)
    await db.checkIns.bulkAdd(data.checkIns)
  })
}
