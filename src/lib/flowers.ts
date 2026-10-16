import { config } from '../content/config'
import { fallbackNotes, gardenNotes } from '../content/gardenNotes'
import { addDays, daysBetween, monthDay, type DateKey } from './dates'
import { pick, range, seeded, shuffled } from './random'

/** Must match the root object names in public/models/flowers.glb (built in blender/flowers.blend). */
export const SPECIES = ['daisy', 'cosmos', 'tulip', 'lotus', 'rose', 'sayapatri', 'gurans'] as const
export type Species = (typeof SPECIES)[number]

interface Palette {
  petal: string
  center: string
}

export const SPECIES_INFO: Record<Species, { label: string; palettes: Palette[] }> = {
  daisy: {
    label: 'Daisy',
    palettes: [
      { petal: '#fff6f0', center: '#ffc93c' },
      { petal: '#ffd3e6', center: '#ffbf3c' },
      { petal: '#d9cbff', center: '#ffd45c' },
    ],
  },
  cosmos: {
    label: 'Cosmos',
    palettes: [
      { petal: '#ff8fc1', center: '#ffd23f' },
      { petal: '#e04f9b', center: '#ffcf4a' },
      { petal: '#ffe1ee', center: '#f9c440' },
    ],
  },
  tulip: {
    label: 'Tulip',
    palettes: [
      { petal: '#ff4d6d', center: '#2b1a12' },
      { petal: '#ffb3c8', center: '#2b1a12' },
      { petal: '#ffd166', center: '#2b1a12' },
      { petal: '#9b6bff', center: '#2b1a12' },
    ],
  },
  lotus: {
    label: 'Lotus',
    palettes: [
      { petal: '#ffb6d2', center: '#ffd86b' },
      { petal: '#fff0f5', center: '#ffcf4f' },
    ],
  },
  rose: {
    label: 'Rose',
    palettes: [
      { petal: '#e0233f', center: '#e0233f' },
      { petal: '#ff9fb5', center: '#ff9fb5' },
      { petal: '#ffc2a1', center: '#ffc2a1' },
    ],
  },
  sayapatri: {
    label: 'Sayapatri (marigold)',
    palettes: [
      { petal: '#ff9a1f', center: '#ff7a00' },
      { petal: '#ffc21a', center: '#ffa400' },
    ],
  },
  gurans: {
    label: 'Lali gurans (rhododendron)',
    palettes: [
      { petal: '#e3173e', center: '#ffe08a' },
      { petal: '#ff6f91', center: '#ffe08a' },
      { petal: '#ffd6e2', center: '#ffe08a' },
    ],
  },
}

export interface GardenDay {
  key: DateKey
  index: number
  species: Species
  petal: string
  center: string
  size: number
  lean: number
  phase: number
  z: number
  /** Shown as a little badge on special days. */
  special?: string
  note: string
}

const birthdayFlowers: Record<string, { species: Species; palette: Palette }> = {}
for (const [i, p] of config.people.entries()) {
  birthdayFlowers[monthDay(p.birthday)] =
    i === 0
      ? { species: 'lotus', palette: { petal: '#fff0f5', center: '#ffcf4f' } }
      : { species: 'gurans', palette: { petal: '#e3173e', center: '#ffe08a' } }
}

/** Fallback notes also come from shuffled bags: no line repeats until every line has been used. */
function noteFor(index: number): string {
  const n = fallbackNotes.length
  const bag = Math.floor(index / n)
  return shuffled(seeded(`${config.startDate}:notes:${bag}`), fallbackNotes)[index % n]
}

/** Species cycle through shuffled "bags" of all seven, so neighbours rarely repeat. */
function speciesFor(index: number): Species {
  const bag = Math.floor(index / SPECIES.length)
  return shuffled(seeded(`${config.startDate}:bag:${bag}`), SPECIES)[index % SPECIES.length]
}

export function gardenDay(key: DateKey, index: number): GardenDay {
  const rnd = seeded(`flower:${key}`)
  let species = speciesFor(index)
  let palette = pick(rnd, SPECIES_INFO[species].palettes)
  let special: string | undefined

  const md = monthDay(key)
  const startDay = config.startDate.slice(8)
  const birthdayOwner = config.people.find((p) => monthDay(p.birthday) === md)

  if (index === 0) {
    species = 'rose'
    palette = SPECIES_INFO.rose.palettes[0]
    special = 'The first bloom'
  } else if (birthdayOwner) {
    ;({ species, palette } = birthdayFlowers[md])
    special = `${birthdayOwner.name ? `${birthdayOwner.name}’s` : 'A'} birthday`
  } else if (key.slice(8) === startDay) {
    const months = Math.round(daysBetween(config.startDate, key) / 30.44)
    species = 'rose'
    palette = SPECIES_INFO.rose.palettes[0]
    special = months % 12 === 0 ? `${months / 12} year${months > 12 ? 's' : ''} of us` : `${months} month${months > 1 ? 's' : ''} of us`
  }

  return {
    key,
    index,
    species,
    petal: palette.petal,
    center: palette.center,
    size: range(rnd, 0.85, 1.12),
    lean: range(rnd, -0.06, 0.06),
    phase: range(rnd, 0, Math.PI * 2),
    z: range(rnd, -0.35, 0.15),
    special,
    note: gardenNotes[key] ?? noteFor(index),
  }
}

/** Every day from the start date through today (at least one flower). */
export function gardenDays(today: DateKey): GardenDay[] {
  const count = Math.max(1, daysBetween(config.startDate, today) + 1)
  const start = count === 1 && daysBetween(config.startDate, today) < 0 ? today : config.startDate
  return Array.from({ length: count }, (_, i) => gardenDay(addDays(start, i), i))
}
