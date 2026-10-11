import { useSyncExternalStore } from 'react'

export type Route =
  | { name: 'today' }
  | { name: 'history' }
  | { name: 'insights' }
  | { name: 'medications' }
  | { name: 'medication'; id: string }
  | { name: 'settings' }
  | { name: 'summary'; id: string }

export type TabName = 'today' | 'history' | 'insights' | 'medications'

export function parseHash(hash: string): Route {
  const [first, second] = hash.replace(/^#\/?/, '').split('/')
  switch (first) {
    case 'history':
      return { name: 'history' }
    case 'insights':
      return { name: 'insights' }
    case 'medications':
      return second ? { name: 'medication', id: decodeURIComponent(second) } : { name: 'medications' }
    case 'settings':
      return { name: 'settings' }
    case 'summary':
      return second ? { name: 'summary', id: decodeURIComponent(second) } : { name: 'insights' }
    default:
      return { name: 'today' }
  }
}

export function routeToHash(route: Route): string {
  switch (route.name) {
    case 'medication':
      return `#/medications/${encodeURIComponent(route.id)}`
    case 'summary':
      return `#/summary/${encodeURIComponent(route.id)}`
    default:
      return `#/${route.name}`
  }
}

/** The tab a route belongs to, for highlighting the tab bar. */
export function tabOf(route: Route): TabName | null {
  switch (route.name) {
    case 'medication':
      return 'medications'
    case 'summary':
      return 'insights'
    case 'settings':
      return null
    default:
      return route.name
  }
}

const subscribe = (cb: () => void) => {
  window.addEventListener('hashchange', cb)
  return () => window.removeEventListener('hashchange', cb)
}

export function useRoute(): Route {
  const hash = useSyncExternalStore(subscribe, () => window.location.hash)
  return parseHash(hash)
}

// Number of in-app navigations we can safely undo with history.back().
let depth = 0

export function navigate(route: Route, opts: { replace?: boolean } = {}) {
  const hash = routeToHash(route)
  if (window.location.hash === hash) return
  if (opts.replace) {
    // Switching tabs starts a fresh stack.
    depth = 0
    window.location.replace(hash)
    return
  }
  depth++
  window.location.hash = hash
}

/** Goes back within the app, or to a fallback when there is nothing to go back to. */
export function goBack(fallback: Route) {
  if (depth > 0) {
    depth--
    window.history.back()
  } else {
    window.location.replace(routeToHash(fallback))
  }
}
