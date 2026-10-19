import type { Feel, SummaryOverview } from '../db/types'
import { FEEL_LABELS, feelColour } from '../ui/colours'

const FEELS: Feel[] = ['good', 'neutral', 'bad']
const MAX_TAGS = 6

const feelText = (feel: Record<Feel, number>) => FEELS.map((f) => `${FEEL_LABELS[f]} ${feel[f]}`).join(', ')
const percent = (n: number, total: number) => `${Math.round((n / Math.max(1, total)) * 100)}%`
const monthLabel = (key: string) => {
  const [y, m] = key.split('-').map(Number)
  return new Date(y, m - 1).toLocaleDateString(undefined, { month: 'short', year: 'numeric' })
}

/** The figures behind an all-time overview: how entries split by feel, the most noticed effects, and entries per month. */
export function OverviewStats({ overview }: { overview: SummaryOverview }) {
  const total = FEELS.reduce((s, f) => s + overview.feel[f], 0)
  const tags = overview.tags.slice(0, MAX_TAGS)
  const maxTag = Math.max(1, ...tags.map((t) => t.count))
  const months = overview.months
  const maxMonth = Math.max(1, ...months.map((m) => m.entries))

  return (
    <section className="animate-fade mb-4 space-y-7 rounded-3xl bg-surface p-6">
      <div>
        <p className="text-4xl font-semibold tabular-nums">{total}</p>
        <p className="text-[15px] text-muted">effects logged</p>
        <FeelBar feel={overview.feel} total={total} className="mt-4 h-3" />
        <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[13px] text-muted">
          {FEELS.map((f) => (
            <li key={f} className="flex items-center gap-1.5">
              <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: feelColour(f) }} />
              {FEEL_LABELS[f]} {percent(overview.feel[f], total)}
            </li>
          ))}
        </ul>
      </div>

      {tags.length > 0 && (
        <div>
          <Heading>Most noticed</Heading>
          <ul className="space-y-3">
            {tags.map((t) => (
              <li key={t.tag}>
                <div className="flex justify-between gap-3 text-[15px]">
                  <span className="truncate">{t.tag}</span>
                  <span className="tabular-nums text-muted">{t.count}×</span>
                </div>
                <div style={{ width: `${(t.count / maxTag) * 100}%` }}>
                  <FeelBar feel={t.feel} total={t.count} className="mt-1.5 h-2" />
                </div>
              </li>
            ))}
          </ul>
        </div>
      )}

      {months.length > 1 && (
        <div>
          <Heading>Month by month</Heading>
          <div className="flex h-28 items-end gap-1" role="img" aria-label={months.map((m) => `${monthLabel(m.month)}: ${m.entries}`).join('; ')}>
            {months.map((m) => (
              <div
                key={m.month}
                title={`${monthLabel(m.month)}: ${m.entries} (${feelText(m.feel)})`}
                className="flex min-h-0.5 flex-1 flex-col-reverse overflow-hidden rounded-t-md bg-surface-2"
                style={{ height: `${(m.entries / maxMonth) * 100}%` }}
              >
                {FEELS.map(
                  (f) =>
                    m.feel[f] > 0 && <span key={f} style={{ height: `${(m.feel[f] / m.entries) * 100}%`, backgroundColor: feelColour(f) }} />,
                )}
              </div>
            ))}
          </div>
          <div className="mt-1.5 flex justify-between text-[13px] text-faint">
            <span>{monthLabel(months[0].month)}</span>
            <span>{monthLabel(months[months.length - 1].month)}</span>
          </div>
        </div>
      )}
    </section>
  )
}

function Heading({ children }: { children: string }) {
  return <h2 className="mb-3 text-sm font-medium uppercase tracking-wider text-muted">{children}</h2>
}

/** One bar split into good, neutral and unwanted. */
function FeelBar({ feel, total, className }: { feel: Record<Feel, number>; total: number; className: string }) {
  return (
    <span role="img" aria-label={feelText(feel)} className={`flex overflow-hidden rounded-full bg-surface-2 ${className}`}>
      {FEELS.map((f) => feel[f] > 0 && <span key={f} style={{ width: `${(feel[f] / Math.max(1, total)) * 100}%`, backgroundColor: feelColour(f) }} />)}
    </span>
  )
}
