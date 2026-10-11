import { goBack, type Route } from '../router'
import { Page, ScreenHeader } from '../ui/layout'
import { Button, EmptyState } from '../ui/primitives'

/** Temporary screen for tabs that later milestones fill in. */
export function PlaceholderScreen({ route }: { route: Route }) {
  const title = route.name[0].toUpperCase() + route.name.slice(1)
  return (
    <>
      <ScreenHeader
        title={title}
        onBack={route.name === 'settings' ? () => goBack({ name: 'today' }) : undefined}
        showSettings={route.name !== 'settings'}
      />
      <Page>
        <EmptyState title="Coming in a later milestone" />
        {import.meta.env.DEV && route.name === 'settings' && (
          <Button
            className="mt-4 w-full"
            onClick={async () => (await import('../dev/sampleData')).loadSampleData()}
          >
            Load sample data (replaces everything)
          </Button>
        )}
      </Page>
    </>
  )
}
