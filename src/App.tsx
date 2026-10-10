import { useLiveQuery } from 'dexie-react-hooks'
import { db } from './db/db'

export default function App() {
  const counts = useLiveQuery(async () => ({
    medications: await db.medications.count(),
    effects: await db.effects.count(),
  }))

  return (
    <main className="pt-safe px-5">
      <h1 className="text-2xl font-semibold">MedLog</h1>
      <p className="text-muted">
        {counts ? `${counts.medications} medications, ${counts.effects} effects` : 'Loading…'}
      </p>
      {import.meta.env.DEV && (
        <button
          className="mt-4 min-h-11 rounded-2xl bg-accent px-4 text-accent-ink"
          onClick={async () => (await import('./dev/sampleData')).loadSampleData()}
        >
          Load sample data
        </button>
      )}
    </main>
  )
}
