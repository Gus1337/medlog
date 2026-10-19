import { SummaryError, type SummaryPrompt, type SummaryProvider } from './provider'

/** Anthropic's recommended default model (checked against the models overview, October 2026). */
export const CLAUDE_MODEL_ID = 'claude-opus-5-5'

/**
 * Calls the Anthropic Messages API straight from the browser with the user's
 * own key. The SDK is loaded only when a summary is generated, and this is the
 * app's only network call.
 */
export class ClaudeSummaryProvider implements SummaryProvider {
  readonly id = 'claude'
  readonly label = 'Claude (Anthropic API)'
  private readonly apiKey: string

  constructor(apiKey: string) {
    this.apiKey = apiKey
  }

  async generate(prompt: SummaryPrompt, signal?: AbortSignal): Promise<string> {
    const { default: Anthropic } = await import('@anthropic-ai/sdk')
    const client = new Anthropic({ apiKey: this.apiKey, dangerouslyAllowBrowser: true })

    let response
    try {
      response = await client.beta.messages.create(
        {
          model: CLAUDE_MODEL_ID,
          max_tokens: 16000,
          thinking: { type: 'adaptive' },
          output_config: { effort: 'medium' },
          // If a safety classifier declines, the API retries on a suitable model instead of failing.
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          system: prompt.system,
          messages: [{ role: 'user', content: prompt.user }],
        },
        { signal },
      )
    } catch (err) {
      throw toSummaryError(err, Anthropic)
    }

    if (response.stop_reason === 'refusal') {
      throw new SummaryError('Claude declined to summarise this period. Nothing was saved.')
    }
    const text = response.content
      .filter((b) => b.type === 'text')
      .map((b) => b.text)
      .join('')
      .trim()
    if (!text) throw new SummaryError('Claude returned an empty summary. Please try again.')
    return text
  }
}

function toSummaryError(err: unknown, Anthropic: typeof import('@anthropic-ai/sdk').default): Error {
  if (err instanceof Anthropic.APIUserAbortError) return new SummaryError('Cancelled.')
  if (err instanceof Anthropic.AuthenticationError) return new SummaryError('The API key was not accepted. Check it in Settings.')
  if (err instanceof Anthropic.PermissionDeniedError) return new SummaryError('This API key is not allowed to use this model.')
  if (err instanceof Anthropic.RateLimitError) return new SummaryError('Anthropic is busy or the key has reached its limit. Try again in a little while.')
  if (err instanceof Anthropic.BadRequestError) return new SummaryError(`The request was not accepted: ${err.message}`)
  if (err instanceof Anthropic.APIConnectionError) return new SummaryError('Could not reach Anthropic. Check your internet connection.')
  if (err instanceof Anthropic.APIError) return new SummaryError(`Anthropic returned an error (${err.status ?? 'unknown'}). Try again later.`)
  return err instanceof Error ? err : new Error(String(err))
}
