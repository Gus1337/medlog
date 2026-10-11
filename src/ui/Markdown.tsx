import type { ReactNode } from 'react'

export type Block = { type: 'h'; level: number; text: string } | { type: 'p'; text: string } | { type: 'ul' | 'ol'; items: string[] }

/** Parses the small Markdown subset summaries use: headings, paragraphs, lists, **bold**. */
export function parseMarkdown(src: string): Block[] {
  const blocks: Block[] = []
  let para: string[] = []
  const flush = () => {
    if (para.length) blocks.push({ type: 'p', text: para.join(' ') })
    para = []
  }
  for (const raw of src.split('\n')) {
    const line = raw.trim()
    const h = /^(#{1,6})\s+(.*)$/.exec(line)
    const ul = /^[-*•]\s+(.*)$/.exec(line)
    const ol = /^\d+[.)]\s+(.*)$/.exec(line)
    if (!line) flush()
    else if (h) {
      flush()
      blocks.push({ type: 'h', level: h[1].length, text: h[2] })
    } else if (ul || ol) {
      flush()
      const type = ul ? 'ul' : 'ol'
      const last = blocks[blocks.length - 1]
      const item = (ul ?? ol)![1]
      if (last?.type === type) last.items.push(item)
      else blocks.push({ type, items: [item] })
    } else para.push(line)
  }
  flush()
  return blocks
}

function inline(text: string): ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) =>
    part.startsWith('**') && part.endsWith('**') ? <strong key={i}>{part.slice(2, -2)}</strong> : part,
  )
}

/** Renders summary Markdown as React elements (no HTML injection). */
export function Markdown({ text }: { text: string }) {
  return (
    <div className="space-y-3 leading-relaxed">
      {parseMarkdown(text).map((b, i) => {
        if (b.type === 'h')
          return (
            <h3 key={i} className="pt-3 text-[17px] font-semibold first:pt-0">
              {inline(b.text)}
            </h3>
          )
        if (b.type === 'p') return <p key={i}>{inline(b.text)}</p>
        const List = b.type === 'ul' ? 'ul' : 'ol'
        return (
          <List key={i} className={`space-y-1.5 pl-5 ${b.type === 'ul' ? 'list-disc' : 'list-decimal'} marker:text-faint`}>
            {b.items.map((item, j) => (
              <li key={j}>{inline(item)}</li>
            ))}
          </List>
        )
      })}
    </div>
  )
}
