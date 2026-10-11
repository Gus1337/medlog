import { describe, expect, it } from 'vitest'
import { parseMarkdown } from './Markdown'

describe('parseMarkdown', () => {
  it('parses headings, paragraphs and lists', () => {
    const md = '## What stood out\nBased on 12 entries.\nSecond line.\n\n- one\n- two\n\n1. first\n2. second'
    expect(parseMarkdown(md)).toEqual([
      { type: 'h', level: 2, text: 'What stood out' },
      { type: 'p', text: 'Based on 12 entries. Second line.' },
      { type: 'ul', items: ['one', 'two'] },
      { type: 'ol', items: ['first', 'second'] },
    ])
  })
})
