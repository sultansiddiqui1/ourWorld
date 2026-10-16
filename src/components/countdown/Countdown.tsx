import { useEffect, useState, type CSSProperties } from 'react'
import { config } from '../../content/config'
import { clock, meetupDateLabel, timeLeft } from '../../lib/meetup'
import CountdownScene from './CountdownScene'

const pad = (n: number) => String(n).padStart(2, '0')

export default function Countdown({ active }: { active: boolean }) {
  const [now, setNow] = useState(() => Date.now())
  const [herLabel, setHerLabel] = useState<HTMLElement | null>(null)
  const [himLabel, setHimLabel] = useState<HTMLElement | null>(null)
  useEffect(() => {
    if (!active) return
    const iv = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(iv)
  }, [active])

  const left = timeLeft(now)
  const { her, him } = config.meetup
  const herClock = clock(her.timeZone, now)
  const hisClock = clock(him.timeZone, now)
  const pct = Math.round(left.progress * 100)

  return (
    <div className="relative h-full select-none">
      <CountdownScene progress={left.progress} arrived={left.arrived} active={active} labels={{ her: herLabel, him: himLabel }} />

      {/* city labels pinned above each island by the scene */}
      <span ref={setHimLabel} className="pointer-events-none absolute top-0 left-0 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#7a3d5a] shadow-sm" style={{ transform: 'translate(-300px,0)' }}>
        ✈︎ {him.city}
      </span>
      <span ref={setHerLabel} className="pointer-events-none absolute top-0 left-0 rounded-full bg-white/80 px-2.5 py-0.5 text-[11px] font-bold text-[#7a3d5a] shadow-sm" style={{ transform: 'translate(-300px,0)' }}>
        📍 {her.city}
      </span>

      {/* the countdown */}
      <div className="pointer-events-none absolute inset-x-0 top-0 px-5 pt-[max(14px,env(safe-area-inset-top))] text-center">
        <p className="text-[11px] font-bold tracking-[0.25em] text-[#7a3d5a]/70 uppercase">Until I see you</p>
        {left.arrived ? (
          <h1 className="card-pop font-display mt-1 text-[40px] leading-tight text-[#5b2440]">Today’s the day! 🎉</h1>
        ) : (
          <>
            <div className="mt-1 flex items-end justify-center gap-2">
              <span className="font-display text-[72px] leading-none text-[#5b2440] tabular-nums">{left.days}</span>
              <span className="mb-2 text-[16px] font-bold text-[#7a3d5a]">{left.days === 1 ? 'day' : 'days'}</span>
            </div>
            <div className="mt-2 flex justify-center gap-2">
              {[
                [left.hours, 'hrs'],
                [left.minutes, 'min'],
                [left.seconds, 'sec'],
              ].map(([v, l]) => (
                <div key={l} className="w-[64px] rounded-2xl bg-white/70 py-1.5 shadow-sm backdrop-blur">
                  <div key={v} className="text-[24px] leading-none font-black text-[#5b2440] tabular-nums">
                    {pad(v as number)}
                  </div>
                  <div className="mt-0.5 text-[10px] font-bold tracking-wider text-[#7a3d5a]/70 uppercase">{l}</div>
                </div>
              ))}
            </div>
          </>
        )}
        <p className="mt-2 text-[13px] font-semibold text-[#7a3d5a]">{meetupDateLabel()}</p>
      </div>

      {/* journey + both clocks */}
      <div className="absolute inset-x-4 bottom-4 space-y-2">
        <div className="rounded-2xl bg-white/75 px-4 py-3 shadow-sm backdrop-blur">
          <div className="flex items-baseline justify-between text-[12px] font-bold text-[#7a3d5a]">
            <span>{left.arrived ? 'Landed. Hold me. 💕' : `✈︎ ${pct}% of the way to you`}</span>
            <span className="text-[#c2547f]">♡</span>
          </div>
          <div className="mt-1.5 h-2.5 overflow-hidden rounded-full bg-[#7a3d5a]/10">
            <div className="h-full rounded-full bg-gradient-to-r from-[#ffb3cb] to-[#ff5f93]" style={{ width: `${Math.max(3, pct)}%` } as CSSProperties} />
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2">
          {[
            { who: her.city, c: herClock, label: 'for you' },
            { who: him.city, c: hisClock, label: 'for me' },
          ].map((x) => (
            <div key={x.label} className="rounded-2xl bg-white/75 px-3 py-2.5 shadow-sm backdrop-blur">
              <p className="text-[10px] font-bold tracking-wider text-[#7a3d5a]/70 uppercase">
                {x.c.night ? '🌙' : '☀️'} {x.label}
              </p>
              <p className="text-[20px] leading-tight font-black text-[#5b2440] tabular-nums">{x.c.text}</p>
              <p className="truncate text-[11px] text-[#7a3d5a]/80">{x.who}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
