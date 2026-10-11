import type { ReactNode } from 'react'
import { navigate, type Route, type TabName } from '../router'
import { Icon, type IconName } from './Icon'
import { IconButton } from './primitives'

const TABS: { name: TabName; label: string; icon: IconName }[] = [
  { name: 'today', label: 'Today', icon: 'today' },
  { name: 'history', label: 'History', icon: 'history' },
  { name: 'insights', label: 'Insights', icon: 'insights' },
  { name: 'medications', label: 'Medications', icon: 'pill' },
]

export function TabBar({ active }: { active: TabName | null }) {
  return (
    <nav
      className="no-print fixed inset-x-0 bottom-0 z-30 border-t border-line bg-bg/90 backdrop-blur-xl pb-safe"
      aria-label="Main"
    >
      <div className="mx-auto flex max-w-xl">
        {TABS.map((t) => {
          const on = active === t.name
          return (
            <button
              key={t.name}
              type="button"
              onClick={() => navigate({ name: t.name } as Route, { replace: true })}
              aria-current={on ? 'page' : undefined}
              className={`flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 pt-1.5 text-[11px] transition-colors duration-500 ${
                on ? 'text-accent' : 'text-faint'
              }`}
            >
              <Icon name={t.icon} size={24} />
              {t.label}
            </button>
          )
        })}
      </div>
    </nav>
  )
}

/** Large calm title with an optional back button and toolbar actions. */
export function ScreenHeader({
  title,
  subtitle,
  onBack,
  actions,
  showSettings = true,
}: {
  title: string
  subtitle?: string
  onBack?: () => void
  actions?: ReactNode
  showSettings?: boolean
}) {
  return (
    <header className="pt-safe no-print px-5">
      <div className="flex min-h-11 items-center justify-between">
        <div className="-ml-3">{onBack && <IconButton icon="back" label="Back" onClick={onBack} />}</div>
        <div className="-mr-3 flex items-center">
          {actions}
          {showSettings && <IconButton icon="settings" label="Settings" onClick={() => navigate({ name: 'settings' })} />}
        </div>
      </div>
      <h1 className="text-[32px] font-semibold leading-tight tracking-tight">{title}</h1>
      {subtitle && <p className="mt-0.5 text-muted">{subtitle}</p>}
    </header>
  )
}

/** Page body with side gutters and room for the tab bar. */
export function Page({ children }: { children: ReactNode }) {
  return <div className="animate-fade mx-auto max-w-xl px-5 pb-32 pt-4">{children}</div>
}
