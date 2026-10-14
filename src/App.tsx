import { lazy, Suspense, useEffect, useState, type ReactNode } from 'react'
import { LockGate } from './components/LockGate'
import { isStandalone } from './lib/standalone'
import { getTheme, readLocalTheme, setTheme } from './lib/theme'
import { tabOf, useRoute, type Route } from './router'
import { HistoryScreen } from './screens/HistoryScreen'
import { InstallScreen } from './screens/InstallScreen'
import { MedicationsScreen } from './screens/MedicationsScreen'
import { SettingsScreen } from './screens/SettingsScreen'
import { TodayScreen } from './screens/TodayScreen'
import { FeedbackProvider } from './ui/feedback'
import { TabBar } from './ui/layout'

// Screens with graphs load on demand, keeping the charting library out of the first load.
const InsightsScreen = lazy(() => import('./screens/InsightsScreen').then((m) => ({ default: m.InsightsScreen })))
const MedicationDetailScreen = lazy(() => import('./screens/MedicationDetailScreen').then((m) => ({ default: m.MedicationDetailScreen })))
const HabitsScreen = lazy(() => import('./screens/HabitsScreen').then((m) => ({ default: m.HabitsScreen })))
const HabitDetailScreen = lazy(() => import('./screens/HabitDetailScreen').then((m) => ({ default: m.HabitDetailScreen })))
const SummaryScreen = lazy(() => import('./screens/SummaryScreen').then((m) => ({ default: m.SummaryScreen })))

export default function App() {
  // Applied synchronously before paint by the inline script in index.html; re-sync against Dexie's
  // stored value (the source of truth) in case it differs, e.g. after a reinstall cleared localStorage.
  useEffect(() => {
    getTheme().then((stored) => {
      if (stored !== readLocalTheme()) setTheme(stored)
    })
  }, [])

  // In development, `?browser` in the URL skips the install screen (for testing in a desktop browser).
  const [devBypass, setDevBypass] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).has('browser'))

  // Logging only works in the installed app (see InstallScreen).
  if (!isStandalone() && !devBypass) {
    return <InstallScreen onContinueDev={import.meta.env.DEV ? () => setDevBypass(true) : undefined} />
  }

  return (
    <FeedbackProvider>
      <LockGate>
        <Shell />
      </LockGate>
    </FeedbackProvider>
  )
}

function Shell() {
  const route = useRoute()
  return (
    <>
      <div key={routeKey(route)}>
        <Suspense fallback={null}>{screenFor(route)}</Suspense>
      </div>
      <TabBar active={tabOf(route)} />
    </>
  )
}

function routeKey(route: Route) {
  return 'id' in route ? `${route.name}/${route.id}` : route.name
}

function screenFor(route: Route): ReactNode {
  switch (route.name) {
    case 'today':
      return <TodayScreen />
    case 'history':
      return <HistoryScreen />
    case 'insights':
      return <InsightsScreen />
    case 'settings':
      return <SettingsScreen />
    case 'summary':
      return <SummaryScreen id={route.id} />
    case 'medications':
      return <MedicationsScreen />
    case 'medication':
      return <MedicationDetailScreen id={route.id} />
    case 'habits':
      return <HabitsScreen />
    case 'habit':
      return <HabitDetailScreen id={route.id} />
  }
}
