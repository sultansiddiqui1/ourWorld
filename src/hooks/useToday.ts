import { useEffect, useState } from 'react'
import { toKey, type DateKey } from '../lib/dates'

/** Today's local date key; updates after midnight and when the app is reopened. */
export function useToday(): DateKey {
  const [today, setToday] = useState(() => toKey(new Date()))
  useEffect(() => {
    const check = () => setToday(toKey(new Date()))
    const id = window.setInterval(check, 60_000)
    document.addEventListener('visibilitychange', check)
    return () => {
      window.clearInterval(id)
      document.removeEventListener('visibilitychange', check)
    }
  }, [])
  return today
}
