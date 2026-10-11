import type { SummaryAggregates } from './aggregate'

/** Something that turns aggregated log statistics into summary text (Markdown). */
export interface SummaryProvider {
  readonly id: string
  readonly label: string
  generate(aggregates: SummaryAggregates, signal?: AbortSignal): Promise<string>
}

/** An error with a calm, user-facing message. */
export class SummaryError extends Error {}
