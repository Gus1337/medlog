import { useLiveQuery } from 'dexie-react-hooks'
import { useState, type ReactNode } from 'react'
import { deleteTag, renameTag, tagUsage } from '../data/entries'
import { useTags } from '../data/hooks'
import { getApiKey, removeApiKey, setApiKey } from '../data/summaries'
import type { Tag } from '../db/types'
import { CLAUDE_MODEL_ID } from '../lib/summary/claude'
import { goBack } from '../router'
import { useFeedback } from '../ui/feedback'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, inputClass } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'

export function SettingsScreen({ extraSections }: { extraSections?: ReactNode }) {
  return (
    <>
      <ScreenHeader title="Settings" onBack={() => goBack({ name: 'today' })} showSettings={false} />
      <Page>
        <div className="space-y-4">
          <AiSection />
          <TagsSection />
          {extraSections}
          {import.meta.env.DEV && <DevSection />}
        </div>
      </Page>
    </>
  )
}

export function SettingsCard({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="animate-fade rounded-3xl bg-surface p-5">
      <h2 className="mb-3 text-lg font-semibold">{title}</h2>
      {children}
    </section>
  )
}

function AiSection() {
  const key = useLiveQuery(async () => (await getApiKey()) ?? '')
  const [draft, setDraft] = useState('')
  const { toast, confirm } = useFeedback()
  if (key === undefined) return null

  return (
    <SettingsCard title="AI summaries">
      <p className="text-[15px] text-muted">
        Summaries are written by Claude through Anthropic’s API, using your own API key. The key is stored only on this
        phone. A request is sent only when you tap Generate.
      </p>
      {key ? (
        <div className="mt-4 space-y-3">
          <p className="rounded-2xl bg-surface-2 px-4 py-3 font-mono text-[15px]">
            {key.slice(0, 10)}…{key.slice(-4)}
          </p>
          <Button
            className="w-full"
            onClick={async () => {
              if (await confirm({ title: 'Remove the API key?', message: 'You can paste it again at any time.', confirmLabel: 'Remove' })) {
                await removeApiKey()
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
            placeholder="sk-ant-…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            autoComplete="off"
            autoCapitalize="off"
            autoCorrect="off"
            spellCheck={false}
            aria-label="Claude API key"
          />
          <Button
            variant="primary"
            className="w-full"
            disabled={!draft.trim().startsWith('sk-')}
            onClick={async () => {
              await setApiKey(draft)
              setDraft('')
              toast('API key saved on this phone')
            }}
          >
            Save key
          </Button>
          <p className="text-[13px] text-faint">Create a key at console.anthropic.com → API keys. Usage is billed to that account.</p>
        </div>
      )}
      <p className="mt-3 text-[13px] text-faint">Model: {CLAUDE_MODEL_ID}</p>
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
