import { useCallback, useMemo, useState } from 'react'
import { config } from '../../content/config'
import { useToday } from '../../hooks/useToday'
import { CONSTELLATIONS, type ConstellationId } from '../../lib/constellations'
import { formatBirthday, formatLong } from '../../lib/dates'
import { gardenDays, SPECIES_INFO } from '../../lib/flowers'
import { Sheet } from '../ui/Sheet'
import GardenView from './GardenView'
import Sky from './Sky'

export default function Universe({ active }: { active: boolean }) {
  const today = useToday()
  const days = useMemo(() => gardenDays(today), [today])
  const [star, setStar] = useState<ConstellationId | null>(null)
  const [openDay, setOpenDay] = useState<number | null>(null)
  const [lastDay, setLastDay] = useState(0)

  const openNote = useCallback((i: number) => {
    setLastDay(i)
    setOpenDay(i)
  }, [])

  const day = days[Math.min(openDay ?? lastDay, days.length - 1)]
  const person = config.people.find((p) => p.constellation === star)
  const cons = star ? CONSTELLATIONS[star] : null

  return (
    <div className="relative flex h-full flex-col">
      <section className="relative min-h-0 flex-[1.15]">
        <Sky active={active} selected={star} onSelect={setStar} />
        <header className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-[max(14px,env(safe-area-inset-top))]">
          <p className="text-[11px] tracking-[0.25em] text-white/50 uppercase">Our universe</p>
          <h1 className="font-display text-[26px] leading-tight text-white">
            Day <span className="text-blush">{days.length}</span> of us
          </h1>
        </header>
        <p className="pointer-events-none absolute right-4 bottom-3 text-[10px] tracking-wider text-white/35">tap a constellation</p>

        {cons && person && (
          <div className="glass card-pop absolute inset-x-4 bottom-4 rounded-2xl p-4" key={cons.id}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="text-[11px] tracking-[0.2em] text-white/50 uppercase">
                  {cons.symbol}{'\uFE0E'} {cons.name}
                </p>
                <p className="font-display text-lg text-white">
                  {person.name ? `${person.name} · ` : ''}
                  {formatBirthday(person.birthday)}
                </p>
                <p className="text-[13px] text-white/70">
                  Born in {person.birthplace}. Guiding star: <span style={{ color: cons.anchorColor }}>{cons.stars[cons.anchor].name}</span>.
                </p>
              </div>
              <button aria-label="Close" onClick={() => setStar(null)} className="-m-2 grid size-10 shrink-0 place-items-center text-white/50">
                ✕
              </button>
            </div>
          </div>
        )}
      </section>

      <section className="relative min-h-0 flex-1 border-t border-white/5">
        <GardenView days={days} active={active} onOpen={openNote} />
      </section>

      <Sheet open={openDay !== null} onClose={() => setOpenDay(null)} label="Flower note">
        {day && (
          <div className="text-center">
            <p className="text-[11px] tracking-[0.22em] text-white/45 uppercase">
              Day {day.index + 1} · {SPECIES_INFO[day.species].label}
            </p>
            <h2 className="font-display mt-1 text-xl text-white">{formatLong(day.key)}</h2>
            {day.special && (
              <span className="mt-2 inline-block rounded-full bg-blush/15 px-3 py-1 text-xs font-semibold text-blush">{day.special}</span>
            )}
            <div className="mx-auto mt-4 h-px w-16" style={{ background: day.petal }} />
            <p className="font-hand mt-4 text-[28px] leading-snug text-white/95">{day.note}</p>
          </div>
        )}
      </Sheet>
    </div>
  )
}
