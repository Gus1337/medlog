import type { ReactNode } from 'react'

/** A calm card for one graph: title, one-line explanation, the graph, a legend and an optional table view. */
export function ChartCard({
  title,
  description,
  controls,
  legend,
  table,
  children,
}: {
  title: string
  description: string
  controls?: ReactNode
  legend?: ReactNode
  /** Same numbers as the graph, for reading without colour. */
  table?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="animate-fade rounded-3xl bg-surface p-5">
      <h3 className="text-lg font-semibold">{title}</h3>
      <p className="mt-0.5 text-[15px] text-muted">{description}</p>
      {controls && <div className="mt-4">{controls}</div>}
      <div className="mt-4">{children}</div>
      {legend && <div className="mt-3">{legend}</div>}
      {table && (
        <details className="mt-3 text-[15px]">
          <summary className="min-h-11 cursor-pointer py-2.5 text-accent">Show the numbers</summary>
          <div className="overflow-x-auto">{table}</div>
        </details>
      )}
    </section>
  )
}

export function LegendRow({ items }: { items: { label: string; colour: string; shape?: 'dot' | 'line' | 'dash' }[] }) {
  return (
    <ul className="flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-1.5">
          {i.shape === 'dash' ? (
            <span className="w-4 border-t-2 border-dashed" style={{ borderColor: i.colour }} />
          ) : (
            <span
              className={i.shape === 'line' ? 'h-0.5 w-4 rounded-full' : 'h-2.5 w-2.5 rounded-full'}
              style={{ backgroundColor: i.colour }}
            />
          )}
          {i.label}
        </li>
      ))}
    </ul>
  )
}

/** Tooltip box used by every chart. */
export function TipBox({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-xl border border-line bg-surface px-3 py-2 text-[13px] text-ink shadow-md">
      <p className="mb-0.5 font-semibold">{title}</p>
      {children}
    </div>
  )
}

export const tableClass = 'w-full text-left text-[14px] [&_td]:py-1 [&_td]:pr-3 [&_th]:pb-1 [&_th]:pr-3 [&_th]:font-medium [&_th]:text-muted'

export function NotEnough({ children }: { children: ReactNode }) {
  return <p className="rounded-2xl border border-dashed border-line px-4 py-6 text-center text-[15px] text-muted">{children}</p>
}
