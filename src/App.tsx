import { useState, type ReactNode } from 'react'
import { isStandalone } from './lib/standalone'
import { tabOf, useRoute, type Route } from './router'
import { HistoryScreen } from './screens/HistoryScreen'
import { InsightsScreen } from './screens/InsightsScreen'
import { InstallScreen } from './screens/InstallScreen'
import { MedicationDetailScreen } from './screens/MedicationDetailScreen'
import { MedicationsScreen } from './screens/MedicationsScreen'
import { PlaceholderScreen } from './screens/PlaceholderScreen'
import { TodayScreen } from './screens/TodayScreen'
import { FeedbackProvider } from './ui/feedback'
import { TabBar } from './ui/layout'

export default function App() {
  // In development, `?browser` in the URL skips the install screen (for testing in a desktop browser).
  const [devBypass, setDevBypass] = useState(() => import.meta.env.DEV && new URLSearchParams(location.search).has('browser'))

  // Logging only works in the installed app (see InstallScreen).
  if (!isStandalone() && !devBypass) {
    return <InstallScreen onContinueDev={import.meta.env.DEV ? () => setDevBypass(true) : undefined} />
  }

  return (
    <FeedbackProvider>
      <Shell />
    </FeedbackProvider>
  )
}

function Shell() {
  const route = useRoute()
  return (
    <>
      <div key={routeKey(route)}>{screenFor(route)}</div>
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
    case 'medications':
      return <MedicationsScreen />
    case 'medication':
      return <MedicationDetailScreen id={route.id} />
    default:
      return <PlaceholderScreen route={route} />
  }
}
