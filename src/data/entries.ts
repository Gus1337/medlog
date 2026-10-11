import { db, newId } from '../db/db'
import type { EffectEntry, Note, Tag } from '../db/types'

export const normaliseTagName = (name: string) => name.trim().replace(/\s+/g, ' ').toLowerCase()

/** Returns the ids for tag names, creating tags that don't exist yet. */
export async function ensureTags(names: string[]): Promise<string[]> {
  const ids: string[] = []
  await db.transaction('rw', db.tags, async () => {
    for (const raw of names) {
      const name = normaliseTagName(raw)
      if (!name) continue
      const existing = await db.tags.where('name').equals(name).first()
      if (existing) ids.push(existing.id)
      else {
        const tag: Tag = { id: newId(), name }
        await db.tags.add(tag)
        ids.push(tag.id)
      }
    }
  })
  return [...new Set(ids)]
}

export async function saveEffect(entry: Omit<EffectEntry, 'id'> & { id?: string }): Promise<string> {
  const id = entry.id ?? newId()
  await db.effects.put({ ...entry, id })
  return id
}

export async function deleteEffect(id: string) {
  await db.effects.delete(id)
}

export async function restoreEffect(entry: EffectEntry) {
  await db.effects.put(entry)
}

export async function saveNote(note: Omit<Note, 'id'> & { id?: string }): Promise<string> {
  const id = note.id ?? newId()
  await db.notes.put({ ...note, id })
  return id
}

export async function deleteNote(id: string) {
  await db.notes.delete(id)
}

export async function restoreNote(note: Note) {
  await db.notes.put(note)
}

export async function renameTag(id: string, name: string): Promise<'ok' | 'exists'> {
  const clean = normaliseTagName(name)
  const clash = await db.tags.where('name').equals(clean).first()
  if (clash && clash.id !== id) return 'exists'
  await db.tags.update(id, { name: clean })
  return 'ok'
}

/** Deletes a tag and removes it from every effect entry that used it. */
export async function deleteTag(id: string) {
  await db.transaction('rw', db.tags, db.effects, async () => {
    await db.effects
      .where('tagIds')
      .equals(id)
      .modify((e) => {
        e.tagIds = e.tagIds.filter((t) => t !== id)
      })
    await db.tags.delete(id)
  })
}

/** How many effect entries use each tag. */
export async function tagUsage(): Promise<Map<string, number>> {
  const counts = new Map<string, number>()
  await db.effects.each((e) => {
    for (const t of e.tagIds) counts.set(t, (counts.get(t) ?? 0) + 1)
  })
  return counts
}
