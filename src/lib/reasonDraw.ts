import { goldenReasons, reasons } from '../content/reasons'
import { shuffled } from './random'

/**
 * The machine's "lottery":
 * - Normal reasons come from a shuffled bag → no repeats until every reason has been seen,
 *   then the bag refills (never starting with the one just shown).
 * - Golden capsules: while unseen golden reasons remain, each pull has a GOLDEN_CHANCE of being
 *   golden, and a golden one is guaranteed after PITY pulls without one. Each golden reason
 *   appears once; after that the machine only gives normal ones.
 * - Everything she's found is kept as her collection.
 */
export const GOLDEN_CHANCE = 0.1
export const PITY = 10

const KEY = 'reasons:v1'

export interface DrawState {
  bag: number[]
  seen: number[]
  goldenSeen: number[]
  pulls: number
  sinceGolden: number
  last: number
}

export interface Pull {
  golden: boolean
  text: string
  /** 1-based position in her collection ("Reason #7"). */
  number: number
  isNew: boolean
}

const fresh = (): DrawState => ({
  bag: shuffled(Math.random, reasons.map((_, i) => i)),
  seen: [],
  goldenSeen: [],
  pulls: 0,
  sinceGolden: 0,
  last: -1,
})

/** Load saved progress, reconciling with the current reason lists (lines may have been added/removed). */
export function loadDraw(): DrawState {
  let s: DrawState
  try {
    s = { ...fresh(), ...JSON.parse(localStorage.getItem(KEY) ?? 'null') }
  } catch {
    s = fresh()
  }
  const valid = (i: number) => Number.isInteger(i) && i >= 0 && i < reasons.length
  s.bag = s.bag.filter(valid)
  s.seen = s.seen.filter(valid)
  s.goldenSeen = s.goldenSeen.filter((i) => i >= 0 && i < goldenReasons.length)
  // newly written reasons join the current bag
  const known = new Set([...s.bag, ...s.seen])
  const added = reasons.map((_, i) => i).filter((i) => !known.has(i))
  if (added.length) s.bag = shuffled(Math.random, [...s.bag, ...added])
  return s
}

function save(s: DrawState) {
  try {
    localStorage.setItem(KEY, JSON.stringify(s))
  } catch {
    /* private mode: progress lasts for this visit only */
  }
}

export function draw(s: DrawState): { state: DrawState; pull: Pull } {
  const next: DrawState = { ...s, bag: [...s.bag], seen: [...s.seen], goldenSeen: [...s.goldenSeen], pulls: s.pulls + 1 }
  const goldenLeft = goldenReasons.map((_, i) => i).filter((i) => !next.goldenSeen.includes(i))
  const golden = goldenLeft.length > 0 && (next.sinceGolden + 1 >= PITY || Math.random() < GOLDEN_CHANCE)

  let pull: Pull
  if (golden) {
    const gi = goldenLeft[Math.floor(Math.random() * goldenLeft.length)]
    next.goldenSeen.push(gi)
    next.sinceGolden = 0
    pull = { golden: true, text: goldenReasons[gi], number: next.goldenSeen.length, isNew: true }
  } else {
    if (next.bag.length === 0) {
      next.bag = shuffled(Math.random, reasons.map((_, i) => i))
      // don't show the same reason twice in a row across a refill
      if (next.bag.length > 1 && next.bag[0] === s.last) next.bag.push(next.bag.shift()!)
    }
    const i = next.bag.shift()!
    const isNew = !next.seen.includes(i)
    if (isNew) next.seen.push(i)
    next.sinceGolden += 1
    next.last = i
    pull = { golden: false, text: reasons[i], number: next.seen.indexOf(i) + 1, isNew }
  }
  save(next)
  return { state: next, pull }
}

export const collection = (s: DrawState) => ({
  normal: s.seen.map((i) => reasons[i]),
  golden: s.goldenSeen.map((i) => goldenReasons[i]),
  total: reasons.length + goldenReasons.length,
})
