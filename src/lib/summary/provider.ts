import type { SummaryAggregates } from './aggregate'

/** Something that turns aggregated log statistics into summary text (Markdown). */
export interface SummaryProvider {
  readonly id: string
  readonly label: string
  generate(aggregates: SummaryAggregates, signal?: AbortSignal): Promise<string>
}

export const PROVIDER_IDS = ['claude', 'openai'] as const
export type ProviderId = (typeof PROVIDER_IDS)[number]

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: 'Claude (Anthropic)',
  openai: 'OpenAI',
}

/** An error with a calm, user-facing message. */
export class SummaryError extends Error {}
