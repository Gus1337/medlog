import { useEffect, useState } from 'react'

/** Current time, refreshed on an interval and when the app returns to the foreground. */
export function useNow(intervalMs = 60_000): number {
  const [now, setNow] = useState(Date.now)
  useEffect(() => {
    const tick = () => setNow(Date.now())
    const id = setInterval(tick, intervalMs)
    document.addEventListener('visibilitychange', tick)
    return () => {
      clearInterval(id)
      document.removeEventListener('visibilitychange', tick)
    }
  }, [intervalMs])
  return now
}
