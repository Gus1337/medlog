import type { EffectEntry, Note, Tag } from '../db/types'

export interface ParsedQuery {
  /** Tag names required exactly (from "#tag" terms). */
  tags: string[]
  /** Free-text words; each must appear in the text or a tag name. */
  words: string[]
}

/** "#calm tired" → tags ["calm"], words ["tired"]. Multi-word tags: "#appetite-loss" or "#appetite_loss". */
export function parseQuery(q: string): ParsedQuery {
  const tags: string[] = []
  const words: string[] = []
  for (const raw of q.toLowerCase().split(/\s+/).filter(Boolean)) {
    if (raw.startsWith('#') && raw.length > 1) tags.push(raw.slice(1).replace(/[-_]/g, ' '))
    else words.push(raw)
  }
  return { tags, words }
}

export const isEmptyQuery = (q: ParsedQuery) => q.tags.length === 0 && q.words.length === 0

export function effectMatches(entry: EffectEntry, q: ParsedQuery, tagsById: Map<string, Tag>): boolean {
  const names = entry.tagIds.map((id) => tagsById.get(id)?.name ?? '')
  if (!q.tags.every((t) => names.includes(t))) return false
  const haystack = `${entry.text} ${names.join(' ')}`.toLowerCase()
  return q.words.every((w) => haystack.includes(w))
}

export function noteMatches(note: Note, q: ParsedQuery): boolean {
  if (q.tags.length > 0) return false
  const text = note.text.toLowerCase()
  return q.words.every((w) => text.includes(w))
}

/** How a tag is written in a query. */
export const tagQuery = (name: string) => `#${name.replace(/\s+/g, '-')}`
