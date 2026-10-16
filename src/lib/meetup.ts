import { config } from '../content/config'

/** Offset (ms) of `timeZone` from UTC at instant `at`. */
function tzOffset(timeZone: string, at: number): number {
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone,
    hourCycle: 'h23',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).formatToParts(new Date(at))
  const p = Object.fromEntries(parts.map((x) => [x.type, x.value]))
  return Date.UTC(+p.year, +p.month - 1, +p.day, +p.hour, +p.minute, +p.second) - at
}

/** A wall-clock time ('YYYY-MM-DD' or 'YYYY-MM-DDTHH:mm') in `timeZone` → epoch ms. DST-safe. */
export function zonedToEpoch(local: string, timeZone: string): number {
  const [d, t = '00:00'] = local.split('T')
  const [y, m, day] = d.split('-').map(Number)
  const [hh, mm] = t.split(':').map(Number)
  const guess = Date.UTC(y, m - 1, day, hh, mm)
  const first = guess - tzOffset(timeZone, guess)
  return guess - tzOffset(timeZone, first)
}

export const meetup = () => {
  const tz = config.meetup.her.timeZone
  return { start: zonedToEpoch(config.meetup.lastGoodbye, tz), end: zonedToEpoch(config.meetup.next, tz) }
}

export interface Left {
  days: number
  hours: number
  minutes: number
  seconds: number
  /** 0 → just said goodbye, 1 → together. */
  progress: number
  arrived: boolean
}

export function timeLeft(now: number): Left {
  const { start, end } = meetup()
  const ms = Math.max(0, end - now)
  const s = Math.floor(ms / 1000)
  return {
    days: Math.floor(s / 86400),
    hours: Math.floor((s % 86400) / 3600),
    minutes: Math.floor((s % 3600) / 60),
    seconds: s % 60,
    progress: Math.min(1, Math.max(0, (now - start) / Math.max(1, end - start))),
    arrived: now >= end,
  }
}

/** "9:40 pm" plus the hour (for sun/moon) in a given zone. */
export function clock(timeZone: string, now: number) {
  const d = new Date(now)
  const text = d.toLocaleTimeString('en-GB', { timeZone, hour: 'numeric', minute: '2-digit', hour12: true })
  const hour = +new Intl.DateTimeFormat('en-US', { timeZone, hour: 'numeric', hourCycle: 'h23' }).format(d)
  return { text, hour, night: hour < 6 || hour >= 19 }
}

export const meetupDateLabel = () =>
  new Date(meetup().end).toLocaleDateString('en-GB', { timeZone: config.meetup.her.timeZone, weekday: 'long', day: 'numeric', month: 'long' })
