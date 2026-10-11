import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState } from 'react'
import {
  BackupError,
  createBackup,
  deleteAllData,
  getLastBackupAt,
  markBackedUp,
  readAllData,
  restoreBackup,
  summariseBackup,
  validateBackup,
} from '../data/backup'
import { deleteSetting, getSetting, setSetting } from '../db/db'
import { buildCsvFiles } from '../lib/csv'
import { hashPin, isValidPin, verifyPin, type PinHash } from '../lib/pin'
import { shareFiles } from '../lib/share'
import { dayKey, formatDay } from '../lib/time'
import { navigate } from '../router'
import { useFeedback } from '../ui/feedback'
import { Button, Field, inputClass, SettingsCard } from '../ui/primitives'
import { Sheet } from '../ui/Sheet'
import { PIN_SETTING } from './LockGate'

export function LockSection() {
  const pin = useLiveQuery(async () => (await getSetting<PinHash>(PIN_SETTING)) ?? null)
  const [mode, setMode] = useState<'set' | 'remove' | null>(null)
  if (pin === undefined) return null
  return (
    <SettingsCard title="Lock">
      <p className="text-[15px] text-muted">
        {pin
          ? 'MedLog asks for your PIN when it opens, and after two minutes in the background.'
          : 'Ask for a PIN when MedLog opens. It keeps people who pick up your phone out of the app; the data on the phone itself is not encrypted.'}
      </p>
      <div className="mt-4 grid gap-3">
        <Button variant={pin ? 'soft' : 'primary'} onClick={() => setMode('set')}>
          {pin ? 'Change PIN' : 'Turn on PIN lock'}
        </Button>
        {pin && <Button onClick={() => setMode('remove')}>Turn off PIN lock</Button>}
      </div>
      {mode && <PinSheet mode={mode} current={pin} onClose={() => setMode(null)} />}
    </SettingsCard>
  )
}

function PinSheet({ mode, current, onClose }: { mode: 'set' | 'remove'; current: PinHash | null; onClose: () => void }) {
  const { toast } = useFeedback()
  const [old, setOld] = useState('')
  const [pin, setPin] = useState('')
  const [again, setAgain] = useState('')
  const [error, setError] = useState<string | null>(null)
  const digits = (v: string) => v.replace(/\D/g, '').slice(0, 8)
  const pinInput = { className: `${inputClass} tracking-[0.4em]`, inputMode: 'numeric' as const, type: 'password', autoComplete: 'off' }

  const save = async () => {
    setError(null)
    if (current && !(await verifyPin(old, current))) {
      setError('The current PIN didn’t match.')
      return false
    }
    if (mode === 'remove') {
      await deleteSetting(PIN_SETTING)
      toast('PIN lock turned off')
      return
    }
    if (!isValidPin(pin)) {
      setError('Use 4 to 8 digits.')
      return false
    }
    if (pin !== again) {
      setError('The two PINs are different.')
      return false
    }
    await setSetting(PIN_SETTING, await hashPin(pin))
    toast('PIN lock is on')
  }

  return (
    <Sheet title={mode === 'remove' ? 'Turn off PIN' : current ? 'Change PIN' : 'Set a PIN'} onClose={onClose} actionLabel="Save" onAction={save}>
      <div className="space-y-5 pt-2">
        {current && (
          <Field label="Current PIN">
            <input {...pinInput} value={old} onChange={(e) => setOld(digits(e.target.value))} autoFocus />
          </Field>
        )}
        {mode === 'set' && (
          <>
            <Field label="New PIN" hint="4 to 8 digits. There is no way to recover a forgotten PIN, so keep a backup.">
              <input {...pinInput} value={pin} onChange={(e) => setPin(digits(e.target.value))} autoFocus={!current} />
            </Field>
            <Field label="New PIN again">
              <input {...pinInput} value={again} onChange={(e) => setAgain(digits(e.target.value))} />
            </Field>
          </>
        )}
        {error && <p className="text-[15px] text-bad">{error}</p>}
      </div>
    </Sheet>
  )
}

export function DataSection() {
  const { toast, confirm } = useFeedback()
  const lastBackup = useLiveQuery(async () => (await getLastBackupAt()) ?? null)
  const [persisted, setPersisted] = useState<boolean | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    navigator.storage?.persisted?.().then(setPersisted, () => setPersisted(null))
  }, [])

  const run = async (task: () => Promise<void>) => {
    setBusy(true)
    try {
      await task()
    } catch (err) {
      toast(err instanceof BackupError ? err.message : 'Something went wrong. Nothing was changed.')
    } finally {
      setBusy(false)
    }
  }

  const exportCsv = () =>
    run(async () => {
      const files = buildCsvFiles(await readAllData()).map(
        (f) => new File([f.content], `medlog-${dayKey(Date.now())}-${f.name}`, { type: 'text/csv' }),
      )
      await shareFiles(files, 'MedLog CSV export')
    })

  const backup = () =>
    run(async () => {
      const b = await createBackup()
      const file = new File([JSON.stringify(b)], `medlog-backup-${dayKey(Date.now())}.json`, { type: 'application/json' })
      if (await shareFiles([file], 'MedLog backup')) {
        await markBackedUp()
        toast('Backup ready')
      }
    })

  const restore = (file: File) =>
    run(async () => {
      let parsed: unknown
      try {
        parsed = JSON.parse(await file.text())
      } catch {
        throw new BackupError('That file isn’t readable as a backup.')
      }
      const b = validateBackup(parsed)
      const ok = await confirm({
        title: 'Restore this backup?',
        message: `From ${new Date(b.exportedAt).toLocaleString()}: ${summariseBackup(b)}. Everything currently in MedLog is replaced.`,
        confirmLabel: 'Restore',
      })
      if (!ok) return
      await restoreBackup(b)
      toast('Backup restored')
    })

  const deleteAll = async () => {
    const ok = await confirm({
      title: 'Delete all data?',
      message:
        'This removes every medication, dose, effect, note, check-in and summary from this phone, plus your API key and PIN. It can’t be undone unless you have a backup file.',
      confirmLabel: 'Delete everything',
    })
    if (!ok) return
    await deleteAllData()
    toast('All data deleted')
    navigate({ name: 'today' }, { replace: true })
  }

  return (
    <>
      <SettingsCard title="Backup">
        <p className="text-[15px] text-muted">
          Everything lives only on this phone. A backup is one file with all your data (not your API key or PIN). Save it to
          Files or iCloud Drive, and restore it here if you ever reinstall.
        </p>
        <p className="mt-3 text-[15px]">
          Last backup:{' '}
          <span className="text-muted">
            {lastBackup ? `${formatDay(new Date(lastBackup).getTime())}, ${new Date(lastBackup).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'not yet'}
          </span>
        </p>
        <div className="mt-4 grid gap-3">
          <Button variant="primary" onClick={backup} disabled={busy}>
            Back up now
          </Button>
          <Button onClick={() => fileInput.current?.click()} disabled={busy}>
            Restore from a backup file
          </Button>
          <input
            ref={fileInput}
            type="file"
            accept="application/json,.json"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0]
              e.target.value = ''
              if (f) restore(f)
            }}
          />
        </div>
        {persisted === false && (
          <p className="mt-3 text-[13px] text-faint">
            The browser hasn’t promised to keep this data permanently. Keeping MedLog on your Home Screen and backing up now
            and then keeps it safe.
          </p>
        )}
      </SettingsCard>

      <SettingsCard title="Export">
        <p className="text-[15px] text-muted">
          All raw data as spreadsheet files (CSV), one per kind of record. Summaries can be printed or saved as PDF from
          each summary’s page.
        </p>
        <Button className="mt-4 w-full" icon="share" onClick={exportCsv} disabled={busy}>
          Export CSV
        </Button>
      </SettingsCard>

      <SettingsCard title="Delete">
        <p className="text-[15px] text-muted">Remove everything MedLog has stored on this phone.</p>
        <Button variant="quiet-danger" className="mt-4 w-full" onClick={deleteAll} disabled={busy}>
          Delete all data
        </Button>
      </SettingsCard>
    </>
  )
}
