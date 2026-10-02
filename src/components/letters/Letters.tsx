import { useGSAP } from '@gsap/react'
import gsap from 'gsap'
import { useRef, useState } from 'react'
import { letters, type Letter } from '../../content/letters'
import { Envelope } from './Envelope'
import { LetterView } from './LetterView'

const KEY = 'letters:opened'

function loadOpened(): Set<string> {
  try {
    return new Set(JSON.parse(localStorage.getItem(KEY) ?? '[]'))
  } catch {
    return new Set()
  }
}

export default function Letters({ active }: { active: boolean }) {
  const [opened, setOpened] = useState(loadOpened)
  const [current, setCurrent] = useState<Letter | null>(null)
  const root = useRef<HTMLDivElement>(null)

  useGSAP(
    () => {
      if (active) gsap.from('.letter-card', { opacity: 0, y: 24, stagger: 0.07, duration: 0.6, ease: 'power2.out' })
    },
    { scope: root, dependencies: [active] },
  )

  const open = (l: Letter) => {
    setCurrent(l)
    setOpened((prev) => {
      const next = new Set(prev).add(l.id)
      try {
        localStorage.setItem(KEY, JSON.stringify([...next]))
      } catch {
        /* private mode — fine */
      }
      return next
    })
  }

  return (
    <div ref={root} className="relative h-full">
      <div className="h-full overflow-y-auto px-5 pt-[max(18px,env(safe-area-inset-top))] pb-8">
        <p className="text-[11px] tracking-[0.25em] text-white/50 uppercase">Letters for you</p>
        <h1 className="font-display text-[28px] leading-tight text-white">
          Open when<span className="text-blush">…</span>
        </h1>
        <p className="mt-1 text-sm text-white/55">Little letters for whenever you need me. Each one comes with my voice.</p>

        <ul className="mt-6 grid grid-cols-2 gap-x-4 gap-y-6">
          {letters.map((l, i) => {
            const isOpen = opened.has(l.id)
            return (
              <li key={l.id} className="letter-card">
                <button onClick={() => open(l)} className="group w-full text-left active:scale-[0.97] transition-transform">
                  <div className="transition-transform duration-300 group-hover:-translate-y-1" style={{ rotate: `${i % 2 ? 1.5 : -1.5}deg` }}>
                    <Envelope color={l.color} emoji={l.emoji} opened={isOpen} className="drop-shadow-[0_10px_18px_rgba(0,0,0,0.35)]" />
                  </div>
                  <p className="mt-3 text-[10px] font-bold tracking-[0.18em] text-white/40 uppercase">
                    Open when {isOpen && <span className="text-blush/70">· opened</span>}
                  </p>
                  <p className="font-hand text-[22px] leading-6 text-white/90">{l.when}</p>
                </button>
              </li>
            )
          })}
        </ul>
      </div>

      {current && <LetterView key={current.id} letter={current} onClose={() => setCurrent(null)} />}
    </div>
  )
}
