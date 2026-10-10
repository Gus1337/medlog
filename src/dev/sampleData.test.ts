import { describe, expect, it } from 'vitest'
import { generateSampleData } from './sampleData'

describe('generateSampleData', () => {
  const now = new Date(2026, 9, 10, 14, 0).getTime()
  const data = generateSampleData(now)

  it('produces a few weeks of entries', () => {
    expect(data.medications).toHaveLength(2)
    expect(data.effects.length).toBeGreaterThan(60)
    expect(data.checkIns.length).toBeGreaterThan(20)
    expect(data.doseLogs.some((d) => d.status === 'skipped')).toBe(true)
  })

  it('never logs anything in the future', () => {
    expect(data.effects.every((e) => e.timestamp <= now)).toBe(true)
    expect(data.doseLogs.every((d) => d.timestamp <= now)).toBe(true)
  })

  it('only references existing medications and tags', () => {
    const meds = new Set(data.medications.map((m) => m.id))
    const tags = new Set(data.tags.map((t) => t.id))
    for (const e of data.effects) {
      expect(e.medicationIds.every((id) => meds.has(id))).toBe(true)
      expect(e.tagIds.every((id) => tags.has(id))).toBe(true)
    }
  })

  it('is deterministic apart from ids', () => {
    const again = generateSampleData(now)
    expect(again.effects.map((e) => [e.timestamp, e.text])).toEqual(data.effects.map((e) => [e.timestamp, e.text]))
  })
})
