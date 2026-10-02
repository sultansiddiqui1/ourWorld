import type { ConstellationId } from '../lib/constellations'

export interface Person {
  /** Optional display name — leave empty to show only the date & place. */
  name: string
  birthday: string // YYYY-MM-DD
  birthplace: string
  constellation: ConstellationId
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
}
