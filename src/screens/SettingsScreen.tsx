import { useLiveQuery } from 'dexie-react-hooks'
import { useState } from 'react'
import { DataSection, LockSection } from '../components/SettingsPrivacy'
import { deleteTag, renameTag, tagUsage } from '../data/entries'
import { useTags } from '../data/hooks'
import { getApiKey, getProvider, removeApiKey, setApiKey, setProvider } from '../data/summaries'
import type { Tag } from '../db/types'
import { CLAUDE_MODEL_ID } from '../lib/summary/claude'
import { OPENAI_MODEL_ID } from '../lib/summary/openai'
import { PROVIDER_IDS, PROVIDER_LABELS, type ProviderId } from '../lib/summary/provider'
import { getTheme, setTheme, THEME_LABELS, THEME_MODES, type ThemeMode } from '../lib/theme'
import { goBack } from '../router'
import { useFeedback } from '../ui/feedback'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, inputClass, Segmented, SettingsCard } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

const MODEL_IDS: Record<ProviderId, string> = { claude: CLAUDE_MODEL_ID, openai: OPENAI_MODEL_ID }
const KEY_PLACEHOLDER: Record<ProviderId, string> = { claude: 'sk-ant-…', openai: 'sk-…' }
const KEY_CONSOLE: Record<ProviderId, string> = { claude: 'console.anthropic.com', openai: 'platform.openai.com' }

export function SettingsScreen() {
  return (
    <>
      <ScreenHeader title="Settings" onBack={() => goBack({ name: 'today' })} showSettings={false} />
      <Page>
        <div className="space-y-4">
          <AppearanceSection />
          <AiSection />
          <TagsSection />
          <LockSection />
          <DataSection />
          {import.meta.env.DEV && <DevSection />}
        </div>
        <p className="mt-8 text-center text-[13px] text-faint">MedLog · no account, no analytics, no tracking.</p>
      </Page>
    </>
  )
}

function AppearanceSection() {
  const theme = useLiveQuery(getTheme)
  if (theme === undefined) return null

  return (
    <SettingsCard title="Appearance">
      <p className="text-[15px] text-muted">Light or dark, or follow this phone’s own setting.</p>
      <div className="mt-4">
        <Segmented<ThemeMode> value={theme} options={THEME_MODES.map((m) => ({ value: m, label: THEME_LABELS[m] }))} onChange={setTheme} />
      </div>
    </SettingsCard>
  )
}

function AiSection() {
  const provider = useLiveQuery(getProvider)
  const key = useLiveQuery(async () => (provider ? (await getApiKey(provider)) ?? '' : undefined), [provider])
  const [draft, setDraft] = useState('')
  const { toast, confirm } = useFeedback()
  if (provider === undefined || key === undefined) return null

  return (
    <SettingsCard title="AI summaries">
      <p className="text-[15px] text-muted">
        Summaries are written by an AI model, using your own API key for that provider. The key is stored only on this
        phone. A request is sent only when you tap Generate.
      </p>
      <div className="mt-4">
        <Segmented<ProviderId>
          value={provider}
          options={PROVIDER_IDS.map((p) => ({ value: p, label: PROVIDER_LABELS[p] }))}
          onChange={(p) => {
            setDraft('')
            setProvider(p)
          }}
        />
      </div>
      {key ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl bg-surface-2 px-4 py-3 font-mono text-[15px]">
            {key.slice(0, 10)}…{key.slice(-4)}
          </p>
          <Button
            className="w-full"
            onClick={async () => {
              if (await confirm({ title: 'Remove the API key?', message: 'You can paste it again at any time.', confirmLabel: 'Remove' })) {
                await removeApiKey(provider)
                toast('API key removed')
              }
            }}
          >
            Remove key
          </Button>
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          <input
            className={`${inputClass} font-mono`}
            placeholder={KEY_PLACEHOLDER[provider]}
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label={`${PROVIDER_LABELS[provider]} API key`}
          />
          <Button
            variant="primary"
            className="w-full"
            disabled={!draft.trim().startsWith('sk-')}
            onClick={async () => {
              await setApiKey(provider, draft)
              setDraft('')
              toast('API key saved on this phone')
            }}
          >
            Save key
          </Button>
          <p className="text-[13px] text-faint">
            Create a key at {KEY_CONSOLE[provider]} → API keys. Usage is billed to that account.
          </p>
        </div>
      )}
      <p className="mt-3 text-[13px] text-faint">Model: {MODEL_IDS[provider]}</p>
    </SettingsCard>
  )
}

function TagsSection() {
  const tags = useTags()
  const usage = useLiveQuery(tagUsage)
  const [editing, setEditing] = useState<Tag | null>(null)

  return (
    <SettingsCard title="Tags">
      {!tags || tags.length === 0 ? (
        <p className="text-[15px] text-muted">Tags you create while logging effects will be listed here, to rename or remove.</p>
      ) : (
        <ul className="-mx-2 divide-y divide-line">
          {tags.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => setEditing(t)} className="flex min-h-11 w-full items-center justify-between px-2 py-2 text-left">
                <span>{t.name}</span>
                <span className="text-[15px] text-faint">{usage?.get(t.id) ?? 0}</span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {editing && <TagSheet tag={editing} uses={usage?.get(editing.id) ?? 0} onClose={() => setEditing(null)} />}
    </SettingsCard>
  )
}

function TagSheet({ tag, uses, onClose }: { tag: Tag; uses: number; onClose: () => void }) {
  const [name, setName] = useState(tag.name)
  const [error, setError] = useState<string | null>(null)
  const { confirm, toast } = useFeedback()

  return (
    <Sheet
      title="Tag"
      onClose={onClose}
      actionLabel="Save"
      actionDisabled={!name.trim()}
      onAction={async () => {
        if ((await renameTag(tag.id, name)) === 'exists') {
          setError('Another tag already has that name.')
          return false
        }
      }}
    >
      <div className="space-y-4 pt-2">
        <input className={inputClass} value={name} onChange={(e) => setName(e.target.value)} aria-label="Tag name" />
        {error && <p className="text-[15px] text-bad">{error}</p>}
        <p className="text-[15px] text-muted">Used on {uses} {uses === 1 ? 'entry' : 'entries'}.</p>
        <Button
          variant="quiet-danger"
          className="w-full"
          onClick={async () => {
            const ok = await confirm({
              title: `Delete “${tag.name}”?`,
              message: 'The tag is removed from every entry that uses it. The entries themselves stay.',
              confirmLabel: 'Delete tag',
            })
            if (ok) {
              await deleteTag(tag.id)
              toast('Tag deleted')
              onClose()
            }
          }}
        >
          Delete tag
        </Button>
      </div>
    </Sheet>
  )
}

function DevSection() {
  const { confirm, toast } = useFeedback()
  return (
    <SettingsCard title="Development">
      <Button
        className="w-full"
        onClick={async () => {
          if (await confirm({ title: 'Load sample data?', message: 'This replaces all data with a few weeks of made-up entries.', confirmLabel: 'Load' })) {
            await (await import('../dev/sampleData')).loadSampleData()
            toast('Sample data loaded')
          }
        }}
      >
        Load sample data
      </Button>
    </SettingsCard>
  )
}
