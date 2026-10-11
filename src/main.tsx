import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App'

// Ask the browser not to evict our IndexedDB data under storage pressure.
navigator.storage?.persist?.().catch(() => {})

// Development helper: `?sample` loads the sample data before rendering.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('sample')) {
  await (await import('./dev/sampleData')).loadSampleData()
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
