import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { AfterDoseChart } from '../components/charts/AfterDoseChart'
import { CalmTimeline } from '../components/charts/CalmTimeline'
import { EffectBreakdown } from '../components/charts/EffectBreakdown'
import { MonthMosaic } from '../components/charts/MonthMosaic'
import { SummarySection } from '../components/SummarySection'
import { useMedications, useTags } from '../data/hooks'
import { db } from '../db/db'
import { addDays, DAY, dayKey, startOfDay } from '../lib/time'
import { medColour } from '../ui/colours'
import { Page, ScreenHeader } from '../ui/layout'
import { Chip, EmptyState, SectionTitle, Segmented } from '../ui/primitives'

type Range = '4w' | '12w' | 'all'
const RANGE_DAYS: Record<Exclude<Range, 'all'>, number> = { '4w': 28, '12w': 84 }

export function InsightsScreen() {
  const meds = useMedications()
  const tags = useTags()
  const [range, setRange] = useState<Range>('4w')
  const [medId, setMedId] = useState<string | null>(null)

  const to = addDays(startOfDay(Date.now()), 1)
  const earliest = useLiveQuery(async () => {
    const [e, d, c] = await Promise.all([
      db.effects.orderBy('timestamp').first(),
      db.doseLogs.orderBy('timestamp').first(),
      db.checkIns.orderBy('date').first(),
    ])
    const candidates = [e?.timestamp, d?.timestamp, c ? new Date(`${c.date}T00:00`).getTime() : undefined].filter(
      (x): x is number => x !== undefined,
    )
    return candidates.length ? startOfDay(Math.min(...candidates)) : null
  })
  const from = range === 'all' ? Math.min(earliest ?? addDays(to, -28), addDays(to, -28)) : addDays(to, -RANGE_DAYS[range])

  const data = useLiveQuery(
    async () => ({
      effects: await db.effects.where('timestamp').between(from, to, true, false).toArray(),
      doseLogs: await db.doseLogs.where('timestamp').between(from - DAY, to, true, false).toArray(),
      checkIns: await db.checkIns.where('date').between(dayKey(from), dayKey(to), true, false).toArray(),
      doseChanges: await db.doseChanges.toArray(),
    }),
    [from, to],
  )

  const visibleMeds = (meds ?? []).filter((m) => !m.isArchived)
  useEffect(() => {
    if (!medId && visibleMeds.length) setMedId(visibleMeds[0].id)
  }, [medId, visibleMeds])
  const med = meds?.find((m) => m.id === medId)

  if (!meds || !data || !tags) return null

  return (
    <>
      <ScreenHeader title="Insights" />
      <Page>
        {meds.length > 0 && <SummarySection medications={meds} />}

        {meds.length === 0 && earliest === null ? (
          <EmptyState icon="insights" title="Graphs will grow here">
            Once you log doses, effects and check-ins, you’ll see how each medication tends to act over the hours after a
            dose, and how you’ve been over the weeks.
          </EmptyState>
        ) : (
          <>
            <SectionTitle>Graphs</SectionTitle>
            <Segmented
              value={range}
              onChange={setRange}
              options={[
                { value: '4w', label: '4 weeks' },
                { value: '12w', label: '3 months' },
                { value: 'all', label: 'All time' },
              ]}
            />
            {visibleMeds.length > 1 && (
              <div className="mt-3 flex flex-wrap gap-2">
                {visibleMeds.map((m) => (
                  <Chip key={m.id} selected={m.id === medId} colour={medColour(m.colour)} onClick={() => setMedId(m.id)}>
                    {m.name}
                  </Chip>
                ))}
              </div>
            )}
            <div className="mt-4 space-y-4">
              {med && <AfterDoseChart medication={med} effects={data.effects} doseLogs={data.doseLogs} tags={tags} />}
              <CalmTimeline
                from={from}
                to={to}
                checkIns={data.checkIns}
                doseChanges={data.doseChanges}
                doseLogs={data.doseLogs}
                medications={meds}
              />
              <MonthMosaic />
              {med && <EffectBreakdown medication={med} effects={data.effects} tags={tags} />}
            </div>
          </>
        )}
      </Page>
    </>
  )
}
