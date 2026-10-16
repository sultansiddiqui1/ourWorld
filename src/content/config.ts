import type { ConstellationId } from '../lib/constellations'

export interface Person {
  /** Optional display name — leave empty to show only the date & place. */
  name: string
  birthday: string // YYYY-MM-DD
  birthplace: string
  constellation: ConstellationId
}

/**
 * Which tabs are switched on. Unfinished ones are visible while developing (`npm run dev`)
 * but hidden from the live site — flip them to `true` when their content is written.
 */
const inDev = import.meta.env.DEV
export const features = {
  letters: inDev, // "Open when" letters — waiting on real letters + voice notes
  reasons: inDev, // vending machine — waiting on real reasons
  punch: true,
  love: true, // "Love me" couple game
  countdown: true, // "Until you" — Berlin ✈︎ Kathmandu
}

export const config = {
  /** Digits typed on the gate screen. TODO: change to something only she knows. */
  passcode: '0000',
  passcodeHint: 'our special date · DDMM',

  /** The day the very first flower bloomed (YYYY-MM-DD). TODO: set to your date. */
  startDate: '2026-09-01',

  welcomeTitle: 'Hi, my love',
  welcomeLine: 'Press play — I recorded something for you.',

  people: [
    { name: '', birthday: '2000-09-18', birthplace: 'Nepalgunj, Nepal', constellation: 'virgo' },
    { name: '', birthday: '2002-04-21', birthplace: 'Hetauda, Nepal', constellation: 'taurus' },
  ] satisfies Person[],

  /** "Until you" countdown. Times are in HER local time zone. */
  meetup: {
    /** When you see each other — add a time if you know it, e.g. '2027-01-02T14:30'. */
    next: '2027-01-02',
    /** When you last said goodbye: the little plane's journey starts here. TODO: set it. */
    lastGoodbye: '2026-09-01',
    /** Cities + IANA time zones. */
    her: { city: 'Kathmandu', timeZone: 'Asia/Kathmandu' },
    him: { city: 'Berlin', timeZone: 'Europe/Berlin' },
  },
}
