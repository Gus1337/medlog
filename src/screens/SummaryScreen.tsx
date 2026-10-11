import { useLiveQuery } from 'dexie-react-hooks'
import { scopeLabel } from '../components/SummarySection'
import { deleteSummary } from '../data/summaries'
import { useMedications } from '../data/hooks'
import { db } from '../db/db'
import { formatDateTime, formatShortDate } from '../lib/time'
import { goBack } from '../router'
import { useFeedback } from '../ui/feedback'
import { Page, ScreenHeader } from '../ui/layout'
import { Markdown } from '../ui/Markdown'
import { Button, EmptyState } from '../ui/primitives'

/** A saved summary to reread, with a print-friendly layout (Print → Save as PDF). */
export function SummaryScreen({ id }: { id: string }) {
  const summary = useLiveQuery(async () => (await db.summaries.get(id)) ?? null, [id])
  const meds = useMedications()
  const { confirm } = useFeedback()
  const back = () => goBack({ name: 'insights' })

  if (summary === undefined || !meds) return null
  if (summary === null) {
    return (
      <>
        <ScreenHeader title="Summary" onBack={back} />
        <Page>
          <EmptyState title="This summary no longer exists" />
        </Page>
      </>
    )
  }

  const title = `${scopeLabel(summary.scope, meds)} summary`
  const range = `${formatShortDate(summary.periodStart)} – ${formatShortDate(summary.periodEnd - 1)}`

  return (
    <>
      <ScreenHeader title={title} subtitle={range} onBack={back} />
      <Page>
        <article className="rounded-3xl bg-surface p-6 print:p-0">
          {/* Print header, since the screen header is hidden when printing. */}
          <header className="mb-4 hidden print:block">
            <h1 className="text-2xl font-semibold">MedLog · {title}</h1>
            <p>{range}</p>
          </header>
          <Markdown text={summary.text} />
          <footer className="mt-6 border-t border-line pt-3 text-[13px] text-muted">
            Based on {summary.entryCount} effect entries. Written {formatDateTime(summary.createdAt)} by Claude from
            aggregated log data. A description of patterns, not medical advice.
          </footer>
        </article>
        <div className="no-print mt-5 grid grid-cols-2 gap-3">
          <Button icon="share" onClick={() => window.print()}>
            Print or PDF
          </Button>
          <Button
            variant="quiet-danger"
            onClick={async () => {
              if (await confirm({ title: 'Delete this summary?', message: 'Your log entries are not affected.', confirmLabel: 'Delete' })) {
                await deleteSummary(summary.id)
                back()
              }
            }}
          >
            Delete
          </Button>
        </div>
        <p className="no-print mt-3 text-[13px] text-faint">
          In the print screen, pinch out on the preview or use Share to save it as a PDF.
        </p>
      </Page>
    </>
  )
}
