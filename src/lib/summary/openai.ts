import type { SummaryAggregates } from './aggregate'
import { buildUserMessage, SYSTEM_PROMPT } from './prompt'
import { SummaryError, type SummaryProvider } from './provider'

/** OpenAI's flagship model at the time of writing; change here if a newer one supersedes it. */
export const OPENAI_MODEL_ID = 'gpt-5.1'

/**
 * Calls OpenAI's Responses API straight from the browser with the user's own
 * key. The SDK is loaded only when a summary is generated, mirroring the
 * Claude provider.
 */
export class OpenAiSummaryProvider implements SummaryProvider {
  readonly id = 'openai'
  readonly label = 'OpenAI'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(aggregates: SummaryAggregates, signal?: AbortSignal): Promise<string> {
    const { default: OpenAI } = await import('openai')
    const client = new OpenAI({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })

    let response
    try {
      response = await client.responses.create(
        {
          model: OPENAI_MODEL_ID,
          instructions: SYSTEM_PROMPT,
          input: buildUserMessage(aggregates),
          max_output_tokens: 4000,
        },
        { signal },
      )
    } catch (err) {
      throw toSummaryError(err, OpenAI)
    }

    const text = response.output_text?.trim()
    if (!text) throw new SummaryError('OpenAI returned an empty summary. Please try again.')
    return text
  }
}

function toSummaryError(err: unknown, OpenAI: typeof import('openai').default): Error {
  if (err instanceof OpenAI.APIUserAbortError) return new SummaryError('Cancelled.')
  if (err instanceof OpenAI.AuthenticationError) return new SummaryError('The API key was not accepted. Check it in Settings.')
  if (err instanceof OpenAI.PermissionDeniedError) return new SummaryError('This API key is not allowed to use this model.')
  if (err instanceof OpenAI.RateLimitError) return new SummaryError('OpenAI is busy or the key has reached its limit. Try again in a little while.')
  if (err instanceof OpenAI.BadRequestError) return new SummaryError(`The request was not accepted: ${err.message}`)
  if (err instanceof OpenAI.APIConnectionError) return new SummaryError('Could not reach OpenAI. Check your internet connection.')
  if (err instanceof OpenAI.APIError) return new SummaryError(`OpenAI returned an error (${err.status ?? 'unknown'}). Try again later.`)
  return err instanceof Error ? err : new Error(String(err))
}
