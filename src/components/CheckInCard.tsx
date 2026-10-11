import { useLiveQuery } from 'dexie-react-hooks'
import { useEffect, useState } from 'react'
import { checkInSkippedOn, saveCheckIn, skipCheckIn, unskipCheckIn, type CheckInValues } from '../data/checkins'
import { db } from '../db/db'
import { useFeedback } from '../ui/feedback'
import { Icon } from '../ui/Icon'
import { Button } from '../ui/primitives'

const SLIDERS: { key: keyof CheckInValues; label: string; low: string; high: string }[] = [
  { key: 'focus', label: 'Focus', low: 'Scattered', high: 'Sharp' },
  { key: 'anxiety', label: 'Anxiety', low: 'Calm', high: 'Very anxious' },
  { key: 'mood', label: 'Mood', low: 'Low', high: 'Bright' },
  { key: 'sleep', label: 'Last night’s sleep', low: 'Poor', high: 'Restful' },
]

const DEFAULTS: CheckInValues = { focus: 3, anxiety: 3, mood: 3, sleep: 3 }

/** Optional evening check-in: four 1-5 sliders. Skippable without fuss. */
export function CheckInCard({ date }: { date: string }) {
  const { toast } = useFeedback()
  // One query so "loading" (undefined) is distinct from "no check-in yet".
  const state = useLiveQuery(
    async () => ({ existing: await db.checkIns.where('date').equals(date).first(), skipped: await checkInSkippedOn() }),
    [date],
  )
  const existing = state?.existing
  const [open, setOpen] = useState(false)
  const [values, setValues] = useState<CheckInValues>(DEFAULTS)

  useEffect(() => {
    if (existing) setValues({ focus: existing.focus, anxiety: existing.anxiety, mood: existing.mood, sleep: existing.sleep })
  }, [existing])

  if (!state) return null
  const isSkipped = state.skipped === date && !existing

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => {
          setOpen(true)
          if (isSkipped) unskipCheckIn()
        }}
        className="animate-fade flex min-h-16 w-full items-center gap-3 rounded-3xl bg-surface px-5 text-left"
      >
        <span className="flex h-10 w-10 items-center justify-center rounded-full bg-accent-soft text-accent">
          <Icon name="moon" size={20} />
        </span>
        <span className="flex-1">
          <span className="block font-medium">Evening check-in</span>
          <span className="block text-[15px] text-muted">
            {existing
              ? `Focus ${existing.focus} · Anxiety ${existing.anxiety} · Mood ${existing.mood} · Sleep ${existing.sleep}`
              : isSkipped
                ? 'Skipped today. Tap if you change your mind.'
                : 'Optional. Four quick sliders, about 20 seconds.'}
          </span>
        </span>
        <Icon name="chevron" size={18} className="text-faint" />
      </button>
    )
  }

  return (
    <section className="animate-fade rounded-3xl bg-surface p-5">
      <h3 className="flex items-center gap-2 text-lg font-semibold">
        <Icon name="moon" size={20} className="text-accent" />
        Evening check-in
      </h3>
      <div className="mt-4 space-y-4">
        {SLIDERS.map((s) => (
          <label key={s.key} className="block">
            <span className="flex justify-between">
              <span className="font-medium">{s.label}</span>
              <span className="tabular-nums text-muted">{values[s.key]}</span>
            </span>
            <input
              type="range"
              min={1}
              max={5}
              step={1}
              value={values[s.key]}
              onChange={(e) => setValues({ ...values, [s.key]: Number(e.target.value) })}
              aria-valuetext={`${values[s.key]} of 5`}
            />
            <span className="-mt-1 flex justify-between text-[13px] text-faint">
              <span>{s.low}</span>
              <span>{s.high}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="mt-5 grid grid-cols-2 gap-3">
        <Button
          onClick={async () => {
            if (!existing) await skipCheckIn(date)
            setOpen(false)
          }}
        >
          {existing ? 'Close' : 'Not today'}
        </Button>
        <Button
          variant="primary"
          onClick={async () => {
            await saveCheckIn(date, values)
            setOpen(false)
            toast('Check-in saved')
          }}
        >
          Save
        </Button>
      </div>
    </section>
  )
}
