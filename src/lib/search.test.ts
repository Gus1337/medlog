import { describe, expect, it } from 'vitest'
import type { EffectEntry, Note, Tag } from '../db/types'
import { effectMatches, noteMatches, parseQuery, tagQuery } from './search'

const tags = new Map<string, Tag>([
  ['t1', { id: 't1', name: 'appetite loss' }],
  ['t2', { id: 't2', name: 'calm' }],
])
const entry: EffectEntry = {
  id: 'e',
  timestamp: 0,
  text: 'Skipped lunch without noticing',
  feel: 'bad',
  tagIds: ['t1'],
  medicationIds: [],
}
const note: Note = { id: 'n', createdAt: 0, text: 'Slept badly, lunch was late' }

describe('search', () => {
  it('parses tags and words', () => {
    expect(parseQuery('  #Appetite-Loss lunch ')).toEqual({ tags: ['appetite loss'], words: ['lunch'] })
  })

  it('matches text case-insensitively', () => {
    expect(effectMatches(entry, parseQuery('LUNCH'), tags)).toBe(true)
    expect(effectMatches(entry, parseQuery('dinner'), tags)).toBe(false)
  })

  it('matches words against tag names too', () => {
    expect(effectMatches(entry, parseQuery('appetite'), tags)).toBe(true)
  })

  it('requires exact tags for #terms', () => {
    expect(effectMatches(entry, parseQuery(tagQuery('appetite loss')), tags)).toBe(true)
    expect(effectMatches(entry, parseQuery('#calm'), tags)).toBe(false)
  })

  it('needs every word to match', () => {
    expect(effectMatches(entry, parseQuery('lunch dinner'), tags)).toBe(false)
  })

  it('searches notes by text and skips them for tag searches', () => {
    expect(noteMatches(note, parseQuery('lunch'))).toBe(true)
    expect(noteMatches(note, parseQuery('#calm'))).toBe(false)
  })
})
