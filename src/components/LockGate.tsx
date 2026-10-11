import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { deleteAllData } from '../data/backup'
import { getSetting } from '../db/db'
import { verifyPin, type PinHash } from '../lib/pin'
import { useFeedback } from '../ui/feedback'
import { Icon } from '../ui/Icon'

export const PIN_SETTING = 'pinHash'
/** Lock again after the app has been in the background this long. */
const RELOCK_AFTER_MS = 2 * 60_000

/** Shows the PIN screen when the app opens (and after a while in the background) if a PIN is set. */
export function LockGate({ children }: { children: ReactNode }) {
  const pin = useLiveQuery(async () => (await getSetting<PinHash>(PIN_SETTING)) ?? null)
  const [unlocked, setUnlocked] = useState(false)
  const hiddenAt = useRef<number | null>(null)

  useEffect(() => {
    const onVisibility = () => {
      if (document.hidden) hiddenAt.current = Date.now()
      else if (hiddenAt.current && Date.now() - hiddenAt.current > RELOCK_AFTER_MS) setUnlocked(false)
    }
    document.addEventListener('visibilitychange', onVisibility)
    return () => document.removeEventListener('visibilitychange', onVisibility)
  }, [])

  if (pin === undefined) return null
  if (pin && !unlocked) return <LockScreen pin={pin} onUnlock={() => setUnlocked(true)} />
  return <>{children}</>
}

function LockScreen({ pin, onUnlock }: { pin: PinHash; onUnlock: () => void }) {
  const [entry, setEntry] = useState('')
  const [message, setMessage] = useState('Enter your PIN')
  const [failures, setFailures] = useState(0)
  const [waitUntil, setWaitUntil] = useState(0)
  const [checking, setChecking] = useState(false)
  const { confirm } = useFeedback()

  const check = async (value: string) => {
    setChecking(true)
    const ok = await verifyPin(value, pin)
    setChecking(false)
    if (ok) return onUnlock()
    const n = failures + 1
    setFailures(n)
    setEntry('')
    if (n >= 5) {
      setWaitUntil(Date.now() + 30_000)
      setMessage('Take a breath. Try again in 30 seconds.')
    } else setMessage('That PIN didn’t match. Try again.')
  }

  const press = (d: string) => {
    if (checking || Date.now() < waitUntil) return
    const next = (entry + d).slice(0, pin.length)
    setEntry(next)
    if (next.length === pin.length) void check(next)
  }

  const forgot = async () => {
    const ok = await confirm({
      title: 'Forgotten your PIN?',
      message:
        'The PIN can’t be recovered. You can erase everything on this phone and start again, then restore your latest backup file from Settings.',
      confirmLabel: 'Erase everything',
    })
    if (ok) {
      await deleteAllData()
      location.reload()
    }
  }

  return (
    <main className="pt-safe pb-safe mx-auto flex min-h-full max-w-sm flex-col items-center px-8">
      <div className="mt-16 flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
        <Icon name="lock" size={26} />
      </div>
      <h1 className="mt-4 text-xl font-semibold">MedLog is locked</h1>
      <p className="mt-1 min-h-6 text-center text-[15px] text-muted" aria-live="polite">
        {message}
      </p>
      <div className="mt-6 flex h-4 gap-3" aria-label={`${entry.length} digits entered`}>
        {Array.from({ length: pin.length }, (_, i) => (
          <span key={i} className={`h-3.5 w-3.5 rounded-full transition-colors duration-300 ${i < entry.length ? 'bg-accent' : 'bg-surface-2'}`} />
        ))}
      </div>
      <div className="mt-10 grid w-full grid-cols-3 gap-4">
        {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((d) => (
          <Key key={d} onClick={() => press(d)}>
            {d}
          </Key>
        ))}
        <button type="button" className="min-h-16 text-[15px] text-muted" onClick={() => setEntry(entry.slice(0, -1))} aria-label="Delete digit">
          Delete
        </button>
        <Key onClick={() => press('0')}>0</Key>
        <span />
      </div>
      <button type="button" onClick={forgot} className="mt-auto min-h-11 pb-4 text-[15px] text-faint">
        Forgot PIN?
      </button>
    </main>
  )
}

function Key({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="mx-auto flex h-18 w-18 items-center justify-center rounded-full bg-surface text-2xl font-light transition-colors duration-200 active:bg-surface-2"
    >
      {children}
    </button>
  )
}
