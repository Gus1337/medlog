import { db, getSetting, newId, setSetting, deleteSetting } from '../db/db'
import type { Summary } from '../db/types'
import { buildAggregates, countEntries, MIN_EFFECT_ENTRIES, type Period, type SummaryScopeInput } from '../lib/summary/aggregate'
import { ClaudeSummaryProvider } from '../lib/summary/claude'
import { OpenAiSummaryProvider } from '../lib/summary/openai'
import { notEnoughDataText } from '../lib/summary/prompt'
import { PROVIDER_LABELS, SummaryError, type ProviderId, type SummaryProvider } from '../lib/summary/provider'
import { DAY } from '../lib/time'

const PROVIDER_SETTING = 'summaryProvider'
const API_KEYS: Record<ProviderId, string> = { claude: 'claudeApiKey', openai: 'openaiApiKey' }

export const getProvider = async () => (await getSetting<ProviderId>(PROVIDER_SETTING)) ?? 'claude'
export const setProvider = (provider: ProviderId) => setSetting(PROVIDER_SETTING, provider)

export const getApiKey = (provider: ProviderId) => getSetting<string>(API_KEYS[provider])
export const setApiKey = (provider: ProviderId, key: string) => setSetting(API_KEYS[provider], key.trim())
export const removeApiKey = (provider: ProviderId) => deleteSetting(API_KEYS[provider])

function makeProvider(provider: ProviderId, apiKey: string): SummaryProvider {
  return provider === 'openai' ? new OpenAiSummaryProvider(apiKey) : new ClaudeSummaryProvider(apiKey)
}

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

  const provider = await getProvider()
  const apiKey = await getApiKey(provider)
  if (!apiKey) throw new SummaryError(`Add your ${PROVIDER_LABELS[provider]} API key in Settings first.`)

  const aggregates = buildAggregates({ medications, effects, doseLogs, doseChanges, checkIns, notes, tags }, scope, period)
  const text = await makeProvider(provider, apiKey).generate(aggregates, signal)

  const summary: Summary = {
    id: newId(),
    createdAt: Date.now(),
    periodStart: period.start,
    periodEnd: period.end,
    scope: scopeKey(scope),
    text,
    entryCount: aggregates.entryCount,
    provider,
  }
  await db.summaries.add(summary)
  return { kind: 'saved', id: summary.id }
}

export const deleteSummary = (id: string) => db.summaries.delete(id)
