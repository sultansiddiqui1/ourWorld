/** Calendar day in local time, formatted YYYY-MM-DD. */
export type DateKey = string

const pad = (n: number) => String(n).padStart(2, '0')

export const toKey = (d: Date): DateKey => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`

export function fromKey(k: DateKey): Date {
  const [y, m, d] = k.split('-').map(Number)
  return new Date(y, m - 1, d)
}

export function addDays(k: DateKey, n: number): DateKey {
  const d = fromKey(k)
  d.setDate(d.getDate() + n)
  return toKey(d)
}

/** Whole days from a to b (DST-safe). */
export function daysBetween(a: DateKey, b: DateKey): number {
  const [y1, m1, d1] = a.split('-').map(Number)
  const [y2, m2, d2] = b.split('-').map(Number)
  return Math.round((Date.UTC(y2, m2 - 1, d2) - Date.UTC(y1, m1 - 1, d1)) / 86_400_000)
}

export const monthDay = (k: DateKey) => k.slice(5)

export const formatLong = (k: DateKey) =>
  fromKey(k).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })

export const formatShort = (k: DateKey) =>
  fromKey(k).toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' })

export const formatBirthday = (k: DateKey) =>
  fromKey(k).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
