/**
 * Real star positions (J2000 right ascension in hours, declination in degrees)
 * and visual magnitudes for the two birthday constellations.
 */
export interface Star {
  name: string
  ra: number
  dec: number
  mag: number
}

export interface ConstellationData {
  id: ConstellationId
  name: string
  symbol: string
  /** Index into `stars` of the brightest star — the glowing anchor. */
  anchor: number
  anchorColor: string
  tint: string
  stars: Star[]
  lines: [number, number][]
  /** Small clusters drawn as stars but not joined by lines (e.g. the Pleiades). */
  loose?: number[]
}

export type ConstellationId = 'virgo' | 'taurus'

const VIRGO: ConstellationData = {
  id: 'virgo',
  name: 'Virgo',
  symbol: '♍',
  anchor: 0,
  anchorColor: '#bcd4ff',
  tint: '#c9d6ff',
  stars: [
    { name: 'Spica', ra: 13.42, dec: -11.16, mag: 0.97 },
    { name: 'Zavijava', ra: 11.845, dec: 1.76, mag: 3.6 },
    { name: 'Zaniah', ra: 12.332, dec: -0.67, mag: 3.9 },
    { name: 'Porrima', ra: 12.694, dec: -1.45, mag: 2.74 },
    { name: 'Auva', ra: 12.927, dec: 3.4, mag: 3.38 },
    { name: 'Vindemiatrix', ra: 13.036, dec: 10.96, mag: 2.83 },
    { name: 'Heze', ra: 13.578, dec: -0.6, mag: 3.37 },
    { name: 'θ Vir', ra: 13.166, dec: -5.54, mag: 4.38 },
    { name: 'Syrma', ra: 14.267, dec: -6.0, mag: 4.08 },
    { name: 'μ Vir', ra: 14.718, dec: -5.66, mag: 3.88 },
    { name: '109 Vir', ra: 14.771, dec: 1.89, mag: 3.72 },
    { name: 'τ Vir', ra: 14.027, dec: 1.54, mag: 4.26 },
    { name: 'ν Vir', ra: 11.764, dec: 6.53, mag: 4.03 },
    { name: 'ο Vir', ra: 12.087, dec: 8.73, mag: 4.12 },
  ],
  lines: [
    [12, 1], [12, 13], [1, 2], [2, 3], [3, 4], [4, 5],
    [3, 7], [7, 0], [4, 6], [6, 0], [6, 11], [11, 10], [0, 8], [8, 9],
  ],
}

const TAURUS: ConstellationData = {
  id: 'taurus',
  name: 'Taurus',
  symbol: '♉',
  anchor: 0,
  anchorColor: '#ffb27a',
  tint: '#ffd7b8',
  stars: [
    { name: 'Aldebaran', ra: 4.599, dec: 16.51, mag: 0.86 },
    { name: 'Elnath', ra: 5.438, dec: 28.61, mag: 1.65 },
    { name: 'Tianguan', ra: 5.627, dec: 21.14, mag: 3.0 },
    { name: 'Prima Hyadum', ra: 4.33, dec: 15.63, mag: 3.65 },
    { name: 'δ¹ Tau', ra: 4.382, dec: 17.54, mag: 3.76 },
    { name: 'Ain', ra: 4.477, dec: 19.18, mag: 3.53 },
    { name: 'θ² Tau', ra: 4.478, dec: 15.87, mag: 3.4 },
    { name: 'λ Tau', ra: 4.011, dec: 12.49, mag: 3.47 },
    { name: 'ο Tau', ra: 3.414, dec: 9.03, mag: 3.6 },
    { name: 'ξ Tau', ra: 3.453, dec: 9.73, mag: 3.7 },
    // The Pleiades
    { name: 'Alcyone', ra: 3.791, dec: 24.11, mag: 2.87 },
    { name: 'Atlas', ra: 3.819, dec: 24.05, mag: 3.6 },
    { name: 'Electra', ra: 3.749, dec: 24.11, mag: 3.7 },
    { name: 'Maia', ra: 3.764, dec: 24.37, mag: 3.9 },
    { name: 'Merope', ra: 3.772, dec: 23.95, mag: 4.2 },
    { name: 'Taygeta', ra: 3.753, dec: 24.47, mag: 4.3 },
    { name: 'Pleione', ra: 3.819, dec: 24.14, mag: 5.0 },
  ],
  lines: [
    [2, 0], [0, 6], [6, 3], [3, 4], [4, 5], [5, 1], [3, 7], [7, 8], [7, 9],
  ],
  loose: [10, 11, 12, 13, 14, 15, 16],
}

export const CONSTELLATIONS: Record<ConstellationId, ConstellationData> = { virgo: VIRGO, taurus: TAURUS }

export interface ProjectedConstellation {
  data: ConstellationData
  /** Local x,y per star, centred on the figure. */
  points: [number, number][]
  anchor: [number, number]
  bounds: { minX: number; maxX: number; minY: number; maxY: number }
}

/**
 * Gnomonic-ish flat projection around the figure's centre. East is left,
 * as it appears looking up at the sky.
 */
export function project(data: ConstellationData, unitsPerDegree: number): ProjectedConstellation {
  const ras = data.stars.map((s) => s.ra)
  const decs = data.stars.map((s) => s.dec)
  const ra0 = (Math.min(...ras) + Math.max(...ras)) / 2
  const dec0 = (Math.min(...decs) + Math.max(...decs)) / 2
  const cosDec = Math.cos((dec0 * Math.PI) / 180)
  const points = data.stars.map(
    (s) => [-(s.ra - ra0) * 15 * cosDec * unitsPerDegree, (s.dec - dec0) * unitsPerDegree] as [number, number],
  )
  const xs = points.map((p) => p[0])
  const ys = points.map((p) => p[1])
  return {
    data,
    points,
    anchor: points[data.anchor],
    bounds: { minX: Math.min(...xs), maxX: Math.max(...xs), minY: Math.min(...ys), maxY: Math.max(...ys) },
  }
}
