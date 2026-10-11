import { db, getSetting, newId, setSetting, deleteSetting } from '../db/db'
import type { Summary } from '../db/types'
import { buildAggregates, countEntries, MIN_EFFECT_ENTRIES, type Period, type SummaryScopeInput } from '../lib/summary/aggregate'
import { ClaudeSummaryProvider } from '../lib/summary/claude'
import { notEnoughDataText } from '../lib/summary/prompt'
import { SummaryError } from '../lib/summary/provider'
import { DAY } from '../lib/time'

const API_KEY = 'claudeApiKey'

export const getApiKey = () => getSetting<string>(API_KEY)
export const setApiKey = (key: string) => setSetting(API_KEY, key.trim())
export const removeApiKey = () => deleteSetting(API_KEY)

export const scopeKey = (scope: SummaryScopeInput) => (scope.kind === 'overall' ? 'overall' : scope.medicationId)

export type GenerateResult = { kind: 'saved'; id: string } | { kind: 'not-enough'; text: string }

/**
 * Builds the aggregates for a scope and week, asks the provider for a summary
 * and saves it. Below the minimum number of entries no request is made.
 */
export async function generateSummary(scope: SummaryScopeInput, period: Period, signal?: AbortSignal): Promise<GenerateResult> {
  const prevStart = period.start - (period.end - period.start)
  const [medications, effects, doseLogs, doseChanges, checkIns, notes, tags] = await Promise.all([
    db.medications.toArray(),
    db.effects.where('timestamp').between(prevStart, period.end, true, false).toArray(),
    db.doseLogs.where('timestamp').between(prevStart - DAY, period.end, true, false).toArray(),
    db.doseChanges.toArray(),
    db.checkIns.toArray(),
    db.notes.where('createdAt').between(period.start, period.end, true, false).toArray(),
    db.tags.toArray(),
  ])
  const entryCount = countEntries(effects, scope, period)
  if (entryCount < MIN_EFFECT_ENTRIES) return { kind: 'not-enough', text: notEnoughDataText(entryCount) }

  const apiKey = await getApiKey()
  if (!apiKey) throw new SummaryError('Add your Claude API key in Settings first.')

  const aggregates = buildAggregates({ medications, effects, doseLogs, doseChanges, checkIns, notes, tags }, scope, period)
  const text = await new ClaudeSummaryProvider(apiKey).generate(aggregates, signal)

  const summary: Summary = {
    id: newId(),
    createdAt: Date.now(),
    periodStart: period.start,
    periodEnd: period.end,
    scope: scopeKey(scope),
    text,
    entryCount: aggregates.entryCount,
  }
  await db.summaries.add(summary)
  return { kind: 'saved', id: summary.id }
}

export const deleteSummary = (id: string) => db.summaries.delete(id)
